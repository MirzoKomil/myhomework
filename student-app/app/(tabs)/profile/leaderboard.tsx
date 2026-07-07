import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentProfileModal } from '@/components/StudentProfileModal';
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
  const [activeDropdown, setActiveDropdown] = useState<'period' | 'scope' | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  const ranked = useMemo(() => getRankedLeaderboard(period, scope, coins), [period, scope, coins]);
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  const rank1Shimmer = useRef(new Animated.Value(0)).current;
  const rank2Shimmer = useRef(new Animated.Value(0)).current;
  const rank3Shimmer = useRef(new Animated.Value(0)).current;
  const crownWobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(rank1Shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(rank1Shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(rank2Shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(rank2Shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(rank3Shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(rank3Shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(400),
      ])
    );
    shimmerLoop.start();
    const wobbleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(crownWobble, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(crownWobble, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    wobbleLoop.start();
    return () => {
      shimmerLoop.stop();
      wobbleLoop.stop();
    };
  }, [rank1Shimmer, rank2Shimmer, rank3Shimmer, crownWobble]);

  const podiumShimmerByIndex = [rank2Shimmer, rank1Shimmer, rank3Shimmer];
  const shimmerTranslate = (anim: Animated.Value) => anim.interpolate({ inputRange: [0, 1], outputRange: [-70, 70] });
  const crownTranslateX = crownWobble.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -2, 0, 2, 0] });
  const crownTranslateY = crownWobble.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -2, 0, 2, 0] });
  const crownRotate = crownWobble.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '-8deg', '0deg', '8deg', '0deg'] });

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
        <View style={styles.filterRow}>
          <Pressable style={styles.dropdownBtn} onPress={() => setActiveDropdown('period')}>
            <Ionicons name="calendar-outline" size={15} color={theme.colors.purple} />
            <Text style={styles.dropdownBtnText}>{LEADERBOARD_PERIOD_LABELS[period]}</Text>
            <Ionicons name="chevron-down" size={15} color={theme.colors.textMuted} />
          </Pressable>
          <Pressable style={styles.dropdownBtn} onPress={() => setActiveDropdown('scope')}>
            <Ionicons name="location-outline" size={15} color={theme.colors.purple} />
            <Text style={styles.dropdownBtnText}>{LEADERBOARD_SCOPE_LABELS[scope]}</Text>
            <Ionicons name="chevron-down" size={15} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.podiumRow}>
          {/* order visually as 2nd, 1st, 3rd */}
          {[top3[1], top3[0], top3[2]].map((entry, i) =>
            entry ? (
              <Pressable
                key={entry.id}
                style={[styles.podiumCol, i === 1 && styles.podiumColCenter]}
                onPress={() => entry.id !== ME_LEADERBOARD_ID && setSelectedStudent(entry.name)}>
                {i === 1 && (
                  <Animated.Text
                    style={[
                      styles.crown,
                      { transform: [{ translateX: crownTranslateX }, { translateY: crownTranslateY }, { rotate: crownRotate }] },
                    ]}>
                    👑
                  </Animated.Text>
                )}
                <View
                  style={[
                    styles.podiumAvatar,
                    { backgroundColor: PODIUM_COLORS[i === 1 ? 0 : i === 0 ? 1 : 2] },
                    i === 1 && styles.podiumAvatarCenter,
                  ]}>
                  <Text style={styles.podiumEmoji}>{entry.avatarEmoji}</Text>
                  <View style={styles.podiumShimmerClip} pointerEvents="none">
                    <Animated.View
                      style={[
                        styles.podiumShimmerSweep,
                        { transform: [{ translateX: shimmerTranslate(podiumShimmerByIndex[i]) }, { rotate: '20deg' }] },
                      ]}>
                      <LinearGradient
                        colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </Animated.View>
                  </View>
                </View>
                <View style={[styles.podiumRankBadge, { backgroundColor: PODIUM_COLORS[i] }]}>
                  <Text style={styles.podiumRankText}>{entry.rank}</Text>
                </View>
                <Text style={styles.podiumName}>{entry.name}</Text>
                <View style={styles.podiumXpPill}>
                  <CoinIcon size={11} />
                  <Text style={styles.podiumXpText}>{entry.displayCoins.toLocaleString('uz-UZ')}</Text>
                </View>
              </Pressable>
            ) : (
              <View key={`empty-${i}`} style={styles.podiumCol} />
            )
          )}
        </View>

        <View style={styles.list}>
          {rest.map((entry) => (
            <Pressable
              key={entry.id}
              style={[styles.listRow, entry.id === ME_LEADERBOARD_ID && styles.listRowMe]}
              onPress={() => entry.id !== ME_LEADERBOARD_ID && setSelectedStudent(entry.name)}>
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
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <CoinInfoModal visible={showCoinInfo} onClose={() => setShowCoinInfo(false)} />
      <StudentProfileModal visible={selectedStudent !== null} studentName={selectedStudent} onClose={() => setSelectedStudent(null)} />

      <Modal visible={activeDropdown !== null} transparent animationType="fade" onRequestClose={() => setActiveDropdown(null)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setActiveDropdown(null)}>
          <Pressable style={styles.dropdownSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.dropdownSheetTitle}>{activeDropdown === 'period' ? 'Davr' : 'Hudud'}</Text>
            {(activeDropdown === 'period' ? PERIODS : SCOPES).map((opt) => {
              const label =
                activeDropdown === 'period'
                  ? LEADERBOARD_PERIOD_LABELS[opt as LeaderboardPeriod]
                  : LEADERBOARD_SCOPE_LABELS[opt as LeaderboardScope];
              const selected = activeDropdown === 'period' ? period === opt : scope === opt;
              return (
                <Pressable
                  key={opt}
                  style={styles.dropdownOption}
                  onPress={() => {
                    if (activeDropdown === 'period') setPeriod(opt as LeaderboardPeriod);
                    else setScope(opt as LeaderboardScope);
                    setActiveDropdown(null);
                  }}>
                  <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextActive]}>{label}</Text>
                  {selected && <Ionicons name="checkmark" size={18} color={theme.colors.purple} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
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
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dropdownBtnText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text },

  dropdownBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dropdownSheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  dropdownSheetTitle: { fontFamily: theme.fonts.extraBold, fontSize: 17, color: theme.colors.text, marginBottom: 10 },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropdownOptionText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },
  dropdownOptionTextActive: { fontFamily: theme.fonts.bold, color: theme.colors.purple },
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
    overflow: 'hidden',
  },
  podiumAvatarCenter: { width: 72, height: 72, borderRadius: 36 },
  podiumShimmerClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  podiumShimmerSweep: { position: 'absolute', top: -20, bottom: -20, width: 30 },
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
