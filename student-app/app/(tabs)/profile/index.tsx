import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { getRankedLeaderboard, ME_LEADERBOARD_ID, profileStats } from '@/data/mock';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  route?: string;
  color?: string;
};

const menuItems: MenuItem[] = [
  { icon: 'calendar', label: 'Haftalik jadval va davomat', route: '/profile/schedule' },
  { icon: 'bar-chart', label: 'Baholar', route: '/profile/grades' },
  { icon: 'chatbubble-ellipses', label: 'Muloqot', route: '/messages' },
  { icon: 'notifications', label: 'Bildirishnomalar', route: '/notifications' },
  { icon: 'book', label: "O'rganilgan lug'atlar", value: `${profileStats.vocabularyCount} ta` },
  { icon: 'document-text', label: "O'rganilgan grammatika", value: `${profileStats.grammarCount} ta` },
  { icon: 'time', label: 'Ilovada sarflangan vaqt', value: `${profileStats.hoursSpent} soat` },
  { icon: 'settings', label: 'Sozlamalar', route: '/profile/settings' },
  { icon: 'card', label: "To'lov tarixi va tarif", route: '/profile/payment' },
];

export default function ProfileScreen() {
  const ranked = getRankedLeaderboard('alltime', 'country');
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
                <Text style={styles.tariffText}>
                  {me ? `⭐ ${me.displayCoins.toLocaleString('uz-UZ')} coin` : ''}
                </Text>
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
              value: profileStats.coins,
              icon: 'star' as const,
              bg: theme.colors.warningBg,
              color: theme.colors.warning,
            },
          ].map((stat) => (
            <View key={stat.label} style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: stat.bg }]}>
                <Ionicons name={stat.icon} size={18} color={stat.color} />
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

        <Pressable style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
          <Text style={styles.logoutText}>Chiqish</Text>
        </Pressable>
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
  tariffText: { fontFamily: theme.fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 6 },
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
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    padding: 16,
    backgroundColor: theme.colors.dangerBg,
    borderRadius: theme.radius.sm,
  },
  logoutText: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.danger },
});
