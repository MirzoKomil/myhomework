import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CoinIcon } from '@/components/ui/CoinIcon';
import { theme } from '@/constants/theme';
import { useCoins, useTodayCoins } from '@/services/coinsStore';

const BADGE_SIZE = 76;

const TIPS: { icon: keyof typeof Ionicons.glyphMap; label: string; route: string }[] = [
  { icon: 'school', label: "Ko'proq dars qil!", route: '/homework' },
  { icon: 'book', label: "Yangi so'zlar yodla!", route: '/vocabulary' },
  { icon: 'game-controller', label: "O'yinlar orqali mashq qil!", route: '/resources/games' },
];

export function CoinInfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const total = useCoins();
  const todayEarned = useTodayCoins();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, shimmerAnim]);

  const shimmerTranslate = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-BADGE_SIZE, BADGE_SIZE] });

  const goTo = (route: string) => {
    onClose();
    router.push(route as never);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.coinBadgeWrap}>
            <CoinIcon size={BADGE_SIZE} />
            <View style={styles.shimmerClip} pointerEvents="none">
              <Animated.View style={[styles.shimmerSweep, { transform: [{ translateX: shimmerTranslate }, { rotate: '25deg' }] }]}>
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.85)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          </View>

          <Text style={styles.totalValue}>{total.toLocaleString('uz-UZ')}</Text>
          <Text style={styles.totalLabel}>jami to'plangan coin</Text>

          {todayEarned > 0 && (
            <View style={styles.todayPill}>
              <Ionicons name="trending-up" size={14} color={theme.colors.success} />
              <Text style={styles.todayText}>Bugun +{todayEarned}</Text>
            </View>
          )}

          <Text style={styles.infoText}>
            Coinlar — darslardagi mashqlarni, uyga vazifalarni va o'yinlarni to'g'ri bajarganingiz uchun
            beriladigan mukofot. To'plangan coinlarni Homework Shop'da sovg'alarga almashtirishingiz mumkin.
          </Text>

          <Text style={styles.tipsTitle}>Ko'proq coin yig'ish uchun</Text>
          <View style={styles.tipsList}>
            {TIPS.map((tip) => (
              <Pressable key={tip.label} style={styles.tipRow} onPress={() => goTo(tip.route)}>
                <View style={styles.tipIconWrap}>
                  <Ionicons name={tip.icon} size={18} color={theme.colors.purple} />
                </View>
                <Text style={styles.tipText}>{tip.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Tushunarli</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  backdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: 'center',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, marginBottom: 18 },

  coinBadgeWrap: { width: BADGE_SIZE, height: BADGE_SIZE, borderRadius: BADGE_SIZE / 2, overflow: 'hidden' },
  shimmerClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  shimmerSweep: { position: 'absolute', top: -BADGE_SIZE * 0.3, bottom: -BADGE_SIZE * 0.3, width: BADGE_SIZE * 0.5 },

  totalValue: { fontFamily: theme.fonts.extraBold, fontSize: 32, color: theme.colors.text, marginTop: 14 },
  totalLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },

  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.successBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 10,
  },
  todayText: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.success },

  infoText: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 16,
  },

  tipsTitle: { alignSelf: 'flex-start', fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.text, marginTop: 20, marginBottom: 10 },
  tipsList: { width: '100%', gap: 8 },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...theme.shadow.card,
  },
  tipIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text },

  closeBtn: { width: '100%', backgroundColor: theme.colors.purple, borderRadius: theme.radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  closeBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
