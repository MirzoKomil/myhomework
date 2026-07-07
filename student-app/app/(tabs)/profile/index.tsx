import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { getRankedLeaderboard, ME_LEADERBOARD_ID, profileStats } from '@/data/mock';
import { useAvatarUri } from '@/services/avatarStore';
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
  { icon: 'ribbon', label: 'Sertifikatlarim', route: '/profile/certificates' },
  { icon: 'cube', label: 'Yetkazib berish xizmati', route: '/profile/book-delivery' },
  { icon: 'card', label: "To'lovlar tarixi", route: '/profile/payment' },
];

export default function ProfileScreen() {
  const coins = useCoins();
  const avatarUri = useAvatarUri();
  const ranked = getRankedLeaderboard('alltime', 'country', coins);
  const me = ranked.find((e) => e.id === ME_LEADERBOARD_ID);

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const wobbleAnim = useRef(new Animated.Value(0)).current;

  const attendanceAnim = useRef(new Animated.Value(0)).current;
  const hoursAnim = useRef(new Animated.Value(0)).current;
  const coinsAnim = useRef(new Animated.Value(0)).current;
  const [displayAttendance, setDisplayAttendance] = useState(0);
  const [displayHours, setDisplayHours] = useState(0);
  const [displayCoins, setDisplayCoins] = useState(0);

  // Har safar bu ekran fokusga kelganda statistika 0 dan joriy qiymatgacha sanaladi.
  useFocusEffect(
    useCallback(() => {
      attendanceAnim.setValue(0);
      hoursAnim.setValue(0);
      coinsAnim.setValue(0);
      setDisplayAttendance(0);
      setDisplayHours(0);
      setDisplayCoins(0);

      const attendanceId = attendanceAnim.addListener(({ value }) => setDisplayAttendance(Math.round(value)));
      const hoursId = hoursAnim.addListener(({ value }) => setDisplayHours(value));
      const coinsId = coinsAnim.addListener(({ value }) => setDisplayCoins(Math.round(value)));

      const animConfig = { duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false };
      Animated.timing(attendanceAnim, { ...animConfig, toValue: profileStats.attendanceRate }).start();
      Animated.timing(hoursAnim, { ...animConfig, toValue: profileStats.hoursSpent }).start();
      Animated.timing(coinsAnim, { ...animConfig, toValue: coins }).start();

      return () => {
        attendanceAnim.removeListener(attendanceId);
        hoursAnim.removeListener(hoursId);
        coinsAnim.removeListener(coinsId);
      };
    }, [attendanceAnim, hoursAnim, coinsAnim, coins])
  );

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(700),
      ])
    );
    shimmerLoop.start();
    const wobbleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wobbleAnim, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(wobbleAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    wobbleLoop.start();
    return () => {
      shimmerLoop.stop();
      wobbleLoop.stop();
    };
  }, [shimmerAnim, wobbleAnim]);

  const shimmerTranslate = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-160, 340] });
  const wobbleTranslateX = wobbleAnim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -3, 0, 3, 0] });
  const wobbleTranslateY = wobbleAnim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -3, 0, 3, 0] });
  const wobbleRotate = wobbleAnim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '-6deg', '0deg', '6deg', '0deg'] });

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
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={32} color={theme.colors.purple} />
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profileStats.name}</Text>
            <Text style={styles.userLevel}>ID {profileStats.studentId}</Text>
          </View>
          <Pressable style={styles.editBtn} onPress={() => router.push('/profile/edit' as never)}>
            <Ionicons name="pencil" size={16} color={theme.colors.blue} />
          </Pressable>
        </Card>

        <Pressable onPress={() => router.push('/profile/leaderboard' as never)}>
          <LinearGradient
            colors={['#7B61FF', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}>
            <View style={styles.shimmerClip} pointerEvents="none">
              <Animated.View style={[styles.shimmerSweep, { transform: [{ translateX: shimmerTranslate }] }]}>
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
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
              <Animated.Text
                style={[
                  styles.trophyEmoji,
                  { transform: [{ translateX: wobbleTranslateX }, { translateY: wobbleTranslateY }, { rotate: wobbleRotate }] },
                ]}>
                🏆
              </Animated.Text>
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.statsRow}>
          {[
            {
              label: 'Davomat',
              value: `${displayAttendance}%`,
              icon: 'checkmark-circle' as const,
              bg: theme.colors.successBg,
              color: theme.colors.success,
            },
            {
              label: 'Vaqt',
              value: `${displayHours.toFixed(1)} soat`,
              icon: 'time' as const,
              bg: theme.colors.blueLight,
              color: theme.colors.blue,
            },
            {
              label: 'Coinlar',
              value: displayCoins,
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
    overflow: 'hidden',
  },
  avatarImage: { width: 64, height: 64 },
  userInfo: { flex: 1 },
  userName: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text },
  userLevel: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: { borderRadius: theme.radius.md, padding: 20, marginBottom: 16, overflow: 'hidden' },
  shimmerClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  shimmerSweep: { position: 'absolute', top: 0, bottom: 0, width: 100 },
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
