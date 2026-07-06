import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/ui/CoinIcon';
import { CoinInfoModal } from '@/components/ui/CoinInfoModal';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import {
  getRankedLeaderboard,
  LEADERBOARD_PERIOD_LABELS,
  LEADERBOARD_SCOPE_LABELS,
  LeaderboardPeriod,
  LeaderboardScope,
  ME_LEADERBOARD_ID,
} from '@/data/mock';
import { useCoins } from '@/services/coinsStore';

const PERIODS: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'alltime'];
const SCOPES: LeaderboardScope[] = ['region', 'country', 'global'];

const PODIUM_COLORS = ['#C0C6D8', '#F2C14E', '#E2A76F'];

export default function LeaderboardScreen() {
  const coins = useCoins();
  const [period, setPeriod] = useState<LeaderboardPeriod>('alltime');
  const [scope, setScope] = useState<LeaderboardScope>('country');
  const [showCoinInfo, setShowCoinInfo] = useState(false);

  const ranked = useMemo(() => getRankedLeaderboard(period, scope, coins), [period, scope, coins]);
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Leaderboard"
        showBack
        rightAction={
          <Pressable style={styles.coinPill} onPress={() => setShowCoinInfo(true)}>
            <CoinIcon size={14} />
            <Text style={styles.coinText}>{coins}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {PERIODS.map((p) => (
            <Pressable
              key={p}
              style={[styles.filterChip, period === p && styles.filterChipActive]}
              onPress={() => setPeriod(p)}>
              <Text style={[styles.filterChipText, period === p && styles.filterChipTextActive]}>
                {LEADERBOARD_PERIOD_LABELS[p]}
              </Text>
            </Pressable>
          ))}
          <View style={styles.filterDivider} />
          {SCOPES.map((s) => (
            <Pressable
              key={s}
              style={[styles.filterChip, scope === s && styles.filterChipActive]}
              onPress={() => setScope(s)}>
              <Text style={[styles.filterChipText, scope === s && styles.filterChipTextActive]}>
                {LEADERBOARD_SCOPE_LABELS[s]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.podiumRow}>
          {/* order visually as 2nd, 1st, 3rd */}
          {[top3[1], top3[0], top3[2]].map((entry, i) =>
            entry ? (
              <View key={entry.id} style={[styles.podiumCol, i === 1 && styles.podiumColCenter]}>
                {i === 1 && <Text style={styles.crown}>👑</Text>}
                <View
                  style={[
                    styles.podiumAvatar,
                    { backgroundColor: PODIUM_COLORS[i === 1 ? 0 : i === 0 ? 1 : 2] },
                    i === 1 && styles.podiumAvatarCenter,
                  ]}>
                  <Text style={styles.podiumEmoji}>{entry.avatarEmoji}</Text>
                </View>
                <View style={[styles.podiumRankBadge, { backgroundColor: PODIUM_COLORS[i] }]}>
                  <Text style={styles.podiumRankText}>{entry.rank}</Text>
                </View>
                <Text style={styles.podiumName}>{entry.name}</Text>
                <View style={styles.podiumXpPill}>
                  <CoinIcon size={11} />
                  <Text style={styles.podiumXpText}>{entry.displayCoins.toLocaleString('uz-UZ')}</Text>
                </View>
              </View>
            ) : (
              <View key={`empty-${i}`} style={styles.podiumCol} />
            )
          )}
        </View>

        <View style={styles.list}>
          {rest.map((entry) => (
            <View key={entry.id} style={[styles.listRow, entry.id === ME_LEADERBOARD_ID && styles.listRowMe]}>
              <Text style={[styles.listRank, entry.id === ME_LEADERBOARD_ID && styles.listRankMe]}>{entry.rank}</Text>
              <View style={styles.listAvatar}>
                <Text style={styles.listAvatarEmoji}>{entry.avatarEmoji}</Text>
              </View>
              <View style={styles.listInfo}>
                <Text style={[styles.listName, entry.id === ME_LEADERBOARD_ID && styles.listNameMe]}>
                  {entry.name}
                </Text>
                <Text style={styles.listMeta}>{entry.lessonsCompleted} dars yakunlandi</Text>
              </View>
              <View style={styles.listXpRow}>
                <CoinIcon size={12} />
                <Text style={styles.listXp}>{entry.displayCoins.toLocaleString('uz-UZ')}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <CoinInfoModal visible={showCoinInfo} onClose={() => setShowCoinInfo(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingTop: 8, paddingBottom: 32 },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.warningBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  coinEmoji: { fontSize: 14 },
  coinText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#B45309' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  filterDivider: { width: 1, height: 18, backgroundColor: theme.colors.border, marginHorizontal: 4 },
  filterChip: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: { backgroundColor: theme.colors.purple, borderColor: theme.colors.purple },
  filterChipText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.textMuted },
  filterChipTextActive: { color: '#fff' },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    marginBottom: 20,
  },
  podiumCol: { alignItems: 'center', flex: 1 },
  podiumColCenter: { marginBottom: 16 },
  crown: { fontSize: 20, marginBottom: 2 },
  podiumAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  podiumAvatarCenter: { width: 72, height: 72, borderRadius: 36 },
  podiumEmoji: { fontSize: 26 },
  podiumRankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: theme.colors.bg,
  },
  podiumRankText: { fontFamily: theme.fonts.extraBold, fontSize: 11, color: '#fff' },
  podiumName: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.text, marginBottom: 4 },
  podiumXpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  podiumXpText: { fontFamily: theme.fonts.semiBold, fontSize: 11, color: theme.colors.text },
  list: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listRowMe: { backgroundColor: theme.colors.purpleLight },
  listRank: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.textMuted, width: 20 },
  listRankMe: { color: theme.colors.purple },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listAvatarEmoji: { fontSize: 18 },
  listInfo: { flex: 1 },
  listName: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
  listNameMe: { color: theme.colors.purple },
  listMeta: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  listXpRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listXp: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.text },
});
