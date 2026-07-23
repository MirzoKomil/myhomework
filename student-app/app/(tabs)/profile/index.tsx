import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { LightningIcon } from '@/components/ui/LightningIcon';
import { LightningInfoModal } from '@/components/ui/LightningInfoModal';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import type { TranslationKey } from '@/i18n/translations';
import { getRankedLeaderboard, ME_LEADERBOARD_ID, profileStats } from '@/data/mock';
import { getLevelProgress } from '@/data/levels';
import { useAvatarUri } from '@/services/avatarStore';
import { useCoins } from '@/services/coinsStore';
import { fetchDemoStudentProfile } from '@/services/contentApi';
import { useLightning } from '@/services/lightningStore';

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: TranslationKey;
  value?: string;
  route?: string;
  color?: string;
};

const menuItems: MenuItem[] = [
  { icon: 'calendar', labelKey: 'profile_schedule', route: '/profile/schedule' },
  { icon: 'person-circle', labelKey: 'profile_my_teacher', route: '/profile/teacher' },
  { icon: 'bar-chart', labelKey: 'profile_grades', route: '/profile/grades' },
  { icon: 'trophy', labelKey: 'profile_motivation', route: '/profile/motivation' },
  { icon: 'stats-chart', labelKey: 'profile_results', route: '/profile/results' },
  { icon: 'ribbon', labelKey: 'profile_certificates', route: '/profile/certificates' },
  { icon: 'cube', labelKey: 'profile_delivery', route: '/profile/book-delivery' },
  { icon: 'card', labelKey: 'profile_payments', route: '/profile/payment' },
  { icon: 'settings-outline', labelKey: 'profile_settings', route: '/profile/settings' },
];

export default function ProfileScreen() {
  const coins = useCoins();
  const lightning = useLightning();
  const avatarUri = useAvatarUri();
  const ranked = getRankedLeaderboard('alltime', 'country', coins, lightning);
  const me = ranked.find((e) => e.id === ME_LEADERBOARD_ID);
  const levelProgress = getLevelProgress(lightning);
  const [showLightningInfo, setShowLightningInfo] = useState(false);
  const { t } = useLang();

  // 40-vazifa: ilgari doim mock namuna ism/ID ko'rsatilardi — endi CRM'da
  // tanlangan (yoki real login qilgan) o'quvchining o'z ma'lumoti
  // ko'rsatiladi, xatolik bo'lsa namuna ma'lumotga qaytiladi.
  const [displayName, setDisplayName] = useState(profileStats.name);
  const [displayId, setDisplayId] = useState(profileStats.studentId);

  useEffect(() => {
    fetchDemoStudentProfile()
      .then((profile) => {
        if (profile?.name) setDisplayName(profile.name);
        if (profile?.studentId) setDisplayId(profile.studentId);
      })
      .catch(() => {});
  }, []);

  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const wobbleAnim = useRef(new Animated.Value(0)).current;

  const lightningAnim = useRef(new Animated.Value(0)).current;
  const [displayLightning, setDisplayLightning] = useState(0);

  // Davomat va Vaqt endi doim joriy qiymatini ko'rsatadi — faqat chaqmoq
  // (badge) raqami har safar ekran fokusga kelganda 0 dan sanaladi.
  useFocusEffect(
    useCallback(() => {
      lightningAnim.setValue(0);
      setDisplayLightning(0);

      const lightningId = lightningAnim.addListener(({ value }) => setDisplayLightning(Math.round(value)));

      const animConfig = { duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false };
      Animated.timing(lightningAnim, { ...animConfig, toValue: lightning }).start();

      return () => {
        lightningAnim.removeListener(lightningId);
      };
    }, [lightningAnim, lightning])
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
      <ScreenHeader title={t('profile_title')} />
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
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userLevel}>ID {displayId}</Text>
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
                <Text style={styles.balanceLabel}>{t('profile_leaderboard')}</Text>
                <Text style={styles.balanceAmount}>{me ? `${me.rank}${t('profile_place_suffix')}` : '—'}</Text>
                {me && (
                  <View style={styles.tariffRow}>
                    <CoinIcon size={12} />
                    <Text style={styles.tariffText}>{me.displayCoins.toLocaleString('uz-UZ')} coin</Text>
                    <LightningIcon size={12} />
                    <Text style={styles.tariffText}>{lightning.toLocaleString('uz-UZ')}</Text>
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
              id: 'attendance',
              label: t('profile_attendance'),
              value: `${profileStats.attendanceRate}%`,
              icon: 'checkmark-circle' as const,
              bg: theme.colors.successBg,
              color: theme.colors.success,
            },
            {
              id: 'time',
              label: t('profile_time'),
              value: `${profileStats.hoursSpent.toFixed(1)} ${t('profile_hour_short')}`,
              icon: 'time' as const,
              bg: theme.colors.blueLight,
              color: theme.colors.blue,
            },
            {
              id: 'streak',
              label: t('profile_streak'),
              value: displayLightning,
              icon: 'badge' as const,
              bg: theme.colors.purpleLight,
              color: theme.colors.purple,
              onPress: () => setShowLightningInfo(true),
            },
          ].map((stat) => (
            <Pressable key={stat.id} style={styles.statBox} onPress={stat.onPress} disabled={!stat.onPress}>
              <View style={[styles.statIconWrap, { backgroundColor: stat.bg }]}>
                {stat.icon === 'badge' ? (
                  <Image source={levelProgress.level.image} style={styles.statBadgeImage} />
                ) : (
                  <Ionicons name={stat.icon} size={18} color={stat.color} />
                )}
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.menu}>
          {menuItems.map((item) => (
            <Pressable
              key={item.route}
              style={styles.menuItem}
              onPress={() => item.route && router.push(item.route as never)}>
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon} size={20} color={theme.colors.purple} />
              </View>
              <Text style={styles.menuLabel}>{t(item.labelKey)}</Text>
              {item.value ? (
                <Text style={styles.menuValue}>{item.value}</Text>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <LightningInfoModal visible={showLightningInfo} onClose={() => setShowLightningInfo(false)} />
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
  statBadgeImage: { width: 22, height: 22, resizeMode: 'contain' },
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
