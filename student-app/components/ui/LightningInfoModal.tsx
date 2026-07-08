import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LightningIcon } from '@/components/ui/LightningIcon';
import { theme } from '@/constants/theme';
import { getLevelProgress, LEVELS } from '@/data/levels';
import { useLightning } from '@/services/lightningStore';

const BADGE_SIZE = 76;

const TIPS: { icon: keyof typeof Ionicons.glyphMap; label: string; route: string }[] = [
  { icon: 'school', label: 'Darslardagi mashqlarni to\'g\'ri bajar!', route: '/homework' },
  { icon: 'game-controller', label: "O'yinlar orqali mashq qil!", route: '/resources/games' },
  { icon: 'flash', label: "Speaking Battle'da g'olib chiq!", route: '/battle' },
];

export function LightningInfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const total = useLightning();
  const progress = getLevelProgress(total);
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

  const goToLevels = () => {
    onClose();
    router.push('/profile/levels' as never);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.badgeWrap}>
            <LightningIcon size={BADGE_SIZE} />
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
          <Text style={styles.totalLabel}>jami to'plangan chaqmoq</Text>

          <Text style={styles.infoText}>
            Chaqmoqlar — darslardagi va o'yinlardagi mashqlarni to'g'ri bajarganingiz uchun beriladi. Coindan farqli
            o'laroq, chaqmoq hech qachon sarflanmaydi — faqat to'planib boradi va darajangizni oshiradi.
          </Text>

          <Pressable style={styles.levelCard} onPress={goToLevels}>
            <Image source={progress.level.image} style={styles.levelImage} />
            <View style={styles.levelInfo}>
              <Text style={styles.levelName}>{progress.level.name}</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progress.progressPercent}%` }]} />
              </View>
              <Text style={styles.levelHint}>
                {progress.next
                  ? `${progress.next.name}gacha yana ${progress.remaining.toLocaleString('uz-UZ')} ta chaqmoq`
                  : 'Eng yuqori darajadasiz!'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
          </Pressable>

          <View style={styles.levelsList}>
            {LEVELS.map((level) => {
              const isCurrent = level.key === progress.level.key;
              const isReached = total >= level.min;
              return (
                <View key={level.key} style={styles.levelRow}>
                  <Image source={level.image} style={[styles.levelRowImage, !isReached && styles.levelRowImageLocked]} />
                  <Text style={[styles.levelRowName, !isReached && styles.levelRowNameLocked]}>{level.name}</Text>
                  {isCurrent ? (
                    <View style={styles.currentPill}>
                      <Text style={styles.currentPillText}>Hozirgi</Text>
                    </View>
                  ) : isReached ? (
                    <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                  ) : (
                    <Ionicons name="lock-closed" size={14} color={theme.colors.textLight} />
                  )}
                </View>
              );
            })}
          </View>

          <Text style={styles.tipsTitle}>Ko'proq chaqmoq yig'ish uchun</Text>
          <View style={styles.tipsList}>
            {TIPS.map((tip) => (
              <Pressable key={tip.label} style={styles.tipRow} onPress={() => goTo(tip.route)}>
                <View style={styles.tipIconWrap}>
                  <Ionicons name={tip.icon} size={18} color={theme.colors.blue} />
                </View>
                <Text style={styles.tipText}>{tip.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textLight} />
              </Pressable>
            ))}
          </View>

          </ScrollView>

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
    maxHeight: '85%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, marginBottom: 18 },
  scrollContent: { alignItems: 'center', width: '100%' },

  badgeWrap: { width: BADGE_SIZE, height: BADGE_SIZE, borderRadius: BADGE_SIZE / 2, overflow: 'hidden' },
  shimmerClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  shimmerSweep: { position: 'absolute', top: -BADGE_SIZE * 0.3, bottom: -BADGE_SIZE * 0.3, width: BADGE_SIZE * 0.5 },

  totalValue: { fontFamily: theme.fonts.extraBold, fontSize: 32, color: theme.colors.text, marginTop: 14 },
  totalLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },

  infoText: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 16,
  },

  levelCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: 14,
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: theme.colors.blue,
    ...theme.shadow.card,
  },
  levelImage: { width: 44, height: 44, resizeMode: 'contain' },
  levelInfo: { flex: 1, gap: 5 },
  levelName: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.text },
  progressBarBg: { height: 5, borderRadius: 3, backgroundColor: theme.colors.border },
  progressBarFill: { height: 5, borderRadius: 3, backgroundColor: theme.colors.blue },
  levelHint: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textMuted },

  levelsList: { width: '100%', marginTop: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.sm, ...theme.shadow.card },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  levelRowImage: { width: 26, height: 26, resizeMode: 'contain' },
  levelRowImageLocked: { opacity: 0.4 },
  levelRowName: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text },
  levelRowNameLocked: { color: theme.colors.textMuted },
  currentPill: { backgroundColor: theme.colors.blueLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  currentPillText: { fontFamily: theme.fonts.bold, fontSize: 10, color: theme.colors.blue },

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
    backgroundColor: theme.colors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text },

  closeBtn: { width: '100%', backgroundColor: theme.colors.blue, borderRadius: theme.radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  closeBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
