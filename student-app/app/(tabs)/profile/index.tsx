import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { getRankedLeaderboard, ME_LEADERBOARD_ID, profileStats } from '@/data/mock';
import { useCoins } from '@/services/coinsStore';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  route?: string;
  color?: string;
};

const menuItems: MenuItem[] = [
  { icon: 'calendar', label: 'Dars jadvali', route: '/profile/schedule' },
  { icon: 'person-circle', label: 'Mening ustozim', route: '/profile/teacher' },
  { icon: 'bar-chart', label: 'Baholar', route: '/profile/grades' },
  { icon: 'trophy', label: 'Motivatsiya tizimi', route: '/profile/motivation' },
  { icon: 'stats-chart', label: 'Natijalarim', route: '/profile/results' },
  { icon: 'card', label: "To'lovlar tarixi", route: '/profile/payment' },
];

export default function ProfileScreen() {
  const coins = useCoins();
  const ranked = getRankedLeaderboard('alltime', 'country', coins);
  const me = ranked.find((e) => e.id === ME_LEADERBOARD_ID);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Profil"
        rightAction={
          <Pressable onPress={() => router.push('/profile/settings')}>
            <Ionicons name="settings-outline" size={22} color={theme.colors.textMuted} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={theme.colors.purple} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profileStats.name}</Text>
            <Text style={styles.userLevel}>{profileStats.level}</Text>
            <Text style={styles.userPhone}>{profileStats.phone}</Text>
          </View>
          <Pressable style={styles.editBtn}>
            <Ionicons name="pencil" size={16} color={theme.colors.blue} />
          </Pressable>
        </Card>

        <Pressable onPress={() => router.push('/profile/leaderboard' as never)}>
          <LinearGradient
            colors={['#7B61FF', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}>
            <View style={styles.leaderboardRow}>
              <View>
                <Text style={styles.balanceLabel}>Leaderboard</Text>
                <Text style={styles.balanceAmount}>{me ? `${me.rank}-o'rin` : '—'}</Text>
                {me && (
                  <View style={styles.tariffRow}>
                    <CoinIcon size={12} />
                    <Text style={styles.tariffText}>{me.displayCoins.toLocaleString('uz-UZ')} coin</Text>
                  </View>
                )}
              </View>
              <Text style={styles.trophyEmoji}>🏆</Text>
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.statsRow}>
          {[
            {
              label: 'Davomat',
              value: `${profileStats.attendanceRate}%`,
              icon: 'checkmark-circle' as const,
              bg: theme.colors.successBg,
              color: theme.colors.success,
            },
            {
              label: 'Vaqt',
              value: `${profileStats.hoursSpent} soat`,
              icon: 'time' as const,
              bg: theme.colors.blueLight,
              color: theme.colors.blue,
            },
            {
              label: 'Coinlar',
              value: coins,
              icon: 'coin' as const,
              bg: theme.colors.warningBg,
              color: theme.colors.warning,
            },
          ].map((stat) => (
            <View key={stat.label} style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: stat.bg }]}>
                {stat.icon === 'coin' ? (
                  <CoinIcon size={18} />
                ) : (
                  <Ionicons name={stat.icon} size={18} color={stat.color} />
                )}
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.menu}>
          {menuItems.map((item) => (
            <Pressable
              key={item.label}
              style={styles.menuItem}
              onPress={() => item.route && router.push(item.route as never)}>
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon} size={20} color={theme.colors.purple} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.value ? (
                <Text style={styles.menuValue}>{item.value}</Text>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: { flex: 1 },
  userName: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text },
  userLevel: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  userPhone: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textLight, marginTop: 2 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: { borderRadius: theme.radius.md, padding: 20, marginBottom: 16 },
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  balanceAmount: { fontFamily: theme.fonts.extraBold, fontSize: 28, color: '#fff', marginTop: 4 },
  tariffRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  tariffText: { fontFamily: theme.fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  trophyEmoji: { fontSize: 48 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: 14,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontFamily: theme.fonts.bold, fontSize: 18, color: theme.colors.text, marginTop: 6 },
  statLabel: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  menu: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, overflow: 'hidden', ...theme.shadow.card },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.text },
  menuValue: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple },
});
