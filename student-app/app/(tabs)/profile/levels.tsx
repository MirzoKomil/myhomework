import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { getLevelProgress, Level, LEVELS } from '@/data/levels';
import { useLightning } from '@/services/lightningStore';

const DETAIL_BADGE_SIZE = 140;

// Ro'yxatdagi qatorlarda ko'rinadigan ma'lumotning kattaroq, tovlanuvchi
// (shimmer) versiyasi — bosilganda darajaning to'liq tafsilotlarini
// ko'rsatadi. LightningInfoModal/CoinInfoModal'dagi shimmer naqshiga o'xshash.
function LevelDetailModal({
  visible,
  onClose,
  level,
  isCurrent,
  isReached,
  lightning,
  progressPercent,
  nextName,
  remainingToNext,
}: {
  visible: boolean;
  onClose: () => void;
  level: Level | null;
  isCurrent: boolean;
  isReached: boolean;
  lightning: number;
  progressPercent: number;
  nextName: string | null;
  remainingToNext: number;
}) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(700),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, shimmerAnim]);

  if (!level) return null;

  const shimmerTranslate = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-DETAIL_BADGE_SIZE, DETAIL_BADGE_SIZE] });
  const remainingToThis = Math.max(0, level.min - lightning);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.detailBackdrop}>
        <Pressable style={styles.detailClose} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={26} color={theme.colors.text} />
        </Pressable>

        <View style={styles.detailContent}>
          <View style={styles.detailGlowOuter} />
          <View style={styles.detailGlowInner} />

          <View style={styles.detailBadgeWrap}>
            <Image source={level.image} style={[styles.detailImage, !isReached && styles.detailImageLocked]} />
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

          <Text style={styles.detailName}>{level.name}</Text>
          {isCurrent ? (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>Hozirgi daraja</Text>
            </View>
          ) : isReached ? (
            <View style={styles.reachedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
              <Text style={styles.reachedBadgeText}>Bosib o'tilgan</Text>
            </View>
          ) : (
            <View style={styles.lockedPill}>
              <Ionicons name="lock-closed" size={13} color={theme.colors.textLight} />
              <Text style={styles.lockedPillText}>Hali qulflangan</Text>
            </View>
          )}

          <Text style={styles.detailDesc}>{level.description}</Text>

          <View style={styles.detailInfoCard}>
            <View style={styles.detailInfoRow}>
              <Ionicons name="flash" size={16} color={theme.colors.blue} />
              <Text style={styles.detailInfoText}>
                {level.max ? `${level.min} – ${level.max} chaqmoq oralig'i` : `${level.min}+ chaqmoq`}
              </Text>
            </View>
            {!isReached && (
              <View style={styles.detailInfoRow}>
                <Ionicons name="lock-closed" size={16} color={theme.colors.textLight} />
                <Text style={styles.detailInfoText}>
                  Ochish uchun yana {remainingToThis.toLocaleString('uz-UZ')} ta chaqmoq kerak
                </Text>
              </View>
            )}
          </View>

          {isCurrent && nextName && (
            <View style={styles.detailProgressBlock}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.progressHint}>
                {nextName} darajasiga yetish uchun yana {remainingToNext.toLocaleString('uz-UZ')} ta chaqmoq kerak
              </Text>
            </View>
          )}

          {isReached && !isCurrent && (
            <View style={styles.detailProgressBlock}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: '100%' }]} />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function LevelsScreen() {
  const lightning = useLightning();
  const progress = getLevelProgress(lightning);
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Darajalar" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Chaqmoq to'plagan sari darajangiz oshib boradi — chaqmoq hech qachon sarflanmaydi, faqat to'planadi.
        </Text>
        {LEVELS.map((level) => {
          const isCurrent = level.key === progress.level.key;
          const isReached = lightning >= level.min;
          return (
            <Pressable key={level.key} onPress={() => setSelectedLevel(level)}>
              <Card
                style={StyleSheet.flatten([styles.card, !isReached && styles.cardLocked, isCurrent && styles.cardCurrent])}>
                {!isReached && (
                  <View style={styles.lockBadge}>
                    <Ionicons name="lock-closed" size={14} color={theme.colors.textLight} />
                  </View>
                )}
                <View style={styles.row}>
                  <Image source={level.image} style={[styles.image, !isReached && styles.imageLocked]} />
                  <View style={styles.info}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, !isReached && styles.nameLocked]}>{level.name}</Text>
                      {isCurrent ? (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Hozirgi</Text>
                        </View>
                      ) : isReached ? (
                        <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                      ) : null}
                    </View>
                    <Text style={[styles.desc, !isReached && styles.descLocked]}>{level.description}</Text>
                    <Text style={styles.range}>
                      {level.max ? `${level.min} – ${level.max} chaqmoq` : `${level.min}+ chaqmoq`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textLight} />
                </View>

                {isCurrent && progress.next && (
                  <View style={styles.progressBlock}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${progress.progressPercent}%` }]} />
                    </View>
                    <Text style={styles.progressHint}>
                      {progress.next.name} darajasiga yetish uchun yana {progress.remaining.toLocaleString('uz-UZ')} ta
                      chaqmoq kerak
                    </Text>
                  </View>
                )}
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>

      <LevelDetailModal
        visible={!!selectedLevel}
        onClose={() => setSelectedLevel(null)}
        level={selectedLevel}
        isCurrent={selectedLevel?.key === progress.level.key}
        isReached={!!selectedLevel && lightning >= selectedLevel.min}
        lightning={lightning}
        progressPercent={progress.progressPercent}
        nextName={progress.next?.name ?? null}
        remainingToNext={progress.remaining}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 12 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginBottom: 4, lineHeight: 19 },

  card: {},
  cardLocked: { opacity: 0.6 },
  cardCurrent: { borderWidth: 1.5, borderColor: theme.colors.blue },
  lockBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  image: { width: 56, height: 56, resizeMode: 'contain' },
  imageLocked: { opacity: 0.5 },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  nameLocked: { color: theme.colors.textMuted },
  currentBadge: { backgroundColor: theme.colors.blueLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  currentBadgeText: { fontFamily: theme.fonts.bold, fontSize: 11, color: theme.colors.blue },
  desc: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  descLocked: { color: theme.colors.textLight },
  range: { fontFamily: theme.fonts.medium, fontSize: 11, color: theme.colors.textLight, marginTop: 3 },

  progressBlock: { marginTop: 14, gap: 6 },
  progressBarBg: { height: 6, borderRadius: 3, backgroundColor: theme.colors.border },
  progressBarFill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.blue },
  progressHint: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted },

  // --- Detail modal ---
  detailBackdrop: { flex: 1, backgroundColor: theme.colors.bg, alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  detailClose: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  detailContent: { alignItems: 'center', width: '100%', marginTop: 60 },
  detailGlowOuter: {
    position: 'absolute',
    top: -10,
    width: DETAIL_BADGE_SIZE + 90,
    height: DETAIL_BADGE_SIZE + 90,
    borderRadius: (DETAIL_BADGE_SIZE + 90) / 2,
    backgroundColor: theme.colors.blueLight,
    opacity: 0.35,
  },
  detailGlowInner: {
    position: 'absolute',
    top: 15,
    width: DETAIL_BADGE_SIZE + 40,
    height: DETAIL_BADGE_SIZE + 40,
    borderRadius: (DETAIL_BADGE_SIZE + 40) / 2,
    backgroundColor: theme.colors.purpleLight,
    opacity: 0.45,
  },
  detailBadgeWrap: { width: DETAIL_BADGE_SIZE, height: DETAIL_BADGE_SIZE, alignItems: 'center', justifyContent: 'center' },
  detailImage: { width: DETAIL_BADGE_SIZE, height: DETAIL_BADGE_SIZE, resizeMode: 'contain' },
  detailImageLocked: { opacity: 0.5 },
  shimmerClip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  shimmerSweep: { position: 'absolute', top: -DETAIL_BADGE_SIZE * 0.3, bottom: -DETAIL_BADGE_SIZE * 0.3, width: DETAIL_BADGE_SIZE * 0.4 },

  detailName: { fontFamily: theme.fonts.extraBold, fontSize: 24, color: theme.colors.text, marginTop: 18, textAlign: 'center' },
  reachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.successBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  reachedBadgeText: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.success },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  lockedPillText: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.textMuted },
  detailDesc: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },

  detailInfoCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    gap: 10,
    marginTop: 20,
    ...theme.shadow.card,
  },
  detailInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailInfoText: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.text, flex: 1 },

  detailProgressBlock: { width: '100%', marginTop: 20, gap: 8 },
});
