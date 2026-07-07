import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { CoinIcon, CoinPill } from '@/components/ui/CoinIcon';
import { CoinInfoModal } from '@/components/ui/CoinInfoModal';
import { theme } from '@/constants/theme';
import { LessonNode, LessonType } from '@/data/mock';
import { getLessonContent, getLessonPossibleCoins } from '@/data/lessonContent';
import { fetchMobileContent } from '@/services/contentApi';
import { useCoins, useLessonCoins } from '@/services/coinsStore';

// ─── Type config ────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<LessonType, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> = {
  grammar: { icon: 'book-outline', color: '#7B61FF', bg: '#EDE9FE', label: 'Videodars' },
  speaking: { icon: 'mic-outline', color: '#2563EB', bg: '#DBEAFE', label: 'Speaking' },
  bonus: { icon: 'gift-outline', color: '#D97706', bg: '#FEF3C7', label: 'Bonus' },
};

// ─── Stars ───────────────────────────────────────────────────────────────────
function Stars({ count }: { count: number }) {
  return (
    <View style={ss.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= count ? 'star' : 'star-outline'}
          size={12}
          color={i <= count ? '#F59E0B' : theme.colors.textLight}
        />
      ))}
    </View>
  );
}

// ─── Type badge ──────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: LessonType }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <View style={[ss.typeBadge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={11} color={cfg.color} />
      <Text style={[ss.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Lesson card ─────────────────────────────────────────────────────────────
function LessonCard({ lesson, isActive, index }: { lesson: LessonNode; isActive: boolean; index: number }) {
  const numText = String(index + 1);
  const earnedCoins = useLessonCoins(lesson.id);
  const possibleCoins = getLessonPossibleCoins(getLessonContent(lesson.id, index));
  const percent = possibleCoins > 0 ? Math.min(100, Math.round((earnedCoins / possibleCoins) * 100)) : 0;
  const isCompleted = !lesson.locked && percent >= 100;

  const glowSpin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isActive) return;
    const loop = Animated.loop(Animated.timing(glowSpin, { toValue: 1, duration: 3000, easing: (t) => t, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [isActive, glowSpin]);
  const glowRotate = glowSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const cardBorderColor = lesson.type === 'bonus' && !lesson.locked
    ? '#F59E0B'
    : isCompleted
      ? theme.colors.success
      : theme.colors.border;

  const cardBg = lesson.type === 'bonus' && !lesson.locked ? '#FFFBEB' : theme.colors.surface;

  const cardBody = (
    <>
      <TypeBadge type={lesson.type} />

      <View style={ss.cardBody}>
        {/* Status circle */}
        {lesson.locked ? (
          <View style={[ss.statusCircle, ss.statusLocked]}>
            <Ionicons name="lock-closed" size={17} color={theme.colors.textLight} />
          </View>
        ) : isCompleted ? (
          <View style={[ss.statusCircle, ss.statusDone]}>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </View>
        ) : isActive ? (
          <View style={[ss.statusCircle, ss.statusActive]}>
            <Text style={ss.statusNumActive}>{numText}</Text>
          </View>
        ) : (
          <View style={[ss.statusCircle, ss.statusDefault]}>
            <Text style={ss.statusNumDefault}>{numText}</Text>
          </View>
        )}

        {/* Content */}
        <View style={ss.cardContent}>
          <View style={ss.titleRow}>
            {isCompleted && (
              <Text style={ss.completedNum}>{numText}</Text>
            )}
            <Text
              style={[
                ss.cardTitle,
                lesson.locked && ss.cardTitleLocked,
                lesson.type === 'bonus' && !lesson.locked && ss.cardTitleBonus,
              ]}
              numberOfLines={1}
            >
              {lesson.title}
            </Text>
          </View>
          <Text style={ss.cardSubtitle} numberOfLines={1}>
            {lesson.subtitle}
          </Text>
          {!lesson.locked && (
            <View style={ss.starsPercent}>
              <Stars count={lesson.stars} />
              <Text style={ss.percentText}>{percent}%</Text>
            </View>
          )}
          <View style={ss.coinRow}>
            <CoinIcon size={13} />
            <Text style={ss.coinRowText}>
              {earnedCoins}/{possibleCoins}
            </Text>
          </View>
        </View>

        {/* Chevron for active */}
        {isActive && (
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        )}
      </View>
    </>
  );

  if (isActive) {
    return (
      <View style={ss.activeGlowWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: glowRotate }] }]}>
          <LinearGradient
            colors={['transparent', 'transparent', '#C4B5FD', theme.colors.purple, '#C4B5FD', 'transparent', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={ss.activeBadge}>
          <Ionicons name="flash" size={11} color="#fff" />
          <Text style={ss.activeBadgeText}>Joriy dars</Text>
        </View>
        <Pressable onPress={() => router.push(`/homework/lesson/${lesson.id}`)} style={ss.activeGlowInner}>
          {cardBody}
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      disabled={lesson.locked}
      onPress={() => router.push(`/homework/lesson/${lesson.id}`)}
      style={[
        ss.card,
        { borderColor: cardBorderColor, backgroundColor: cardBg },
        lesson.locked && ss.cardLocked,
      ]}
    >
      {cardBody}
    </Pressable>
  );
}

// ─── Milestone badge ──────────────────────────────────────────────────────────
function MilestoneBadge({ badge }: { badge: NonNullable<LessonNode['milestone']> }) {
  return (
    <View style={[ss.milestoneBadge, { backgroundColor: badge.bg }]}>
      <Ionicons name={badge.icon} size={22} color={badge.iconColor} />
      <Text style={[ss.milestoneLabel, { color: badge.iconColor }]}>{badge.label}</Text>
      <Text style={[ss.milestoneSub, { color: badge.iconColor }]}>{badge.sub}</Text>
    </View>
  );
}

// ─── Path connector ───────────────────────────────────────────────────────────
const CONNECTOR_H = 56;

function PathConnector({
  fromSide,
  toX,
  completed,
}: {
  fromSide: 'left' | 'right';
  toX?: number;
  completed: boolean;
}) {
  const color = completed ? theme.colors.success : theme.colors.purpleLight;
  const startX = fromSide === 'left' ? 28 : 72;
  const endX = toX ?? (fromSide === 'left' ? 72 : 28);
  const d = `M ${startX} 0 C ${startX} ${CONNECTOR_H * 0.6}, ${endX} ${CONNECTOR_H * 0.4}, ${endX} ${CONNECTOR_H}`;

  return (
    <View style={ss.connectorWrap}>
      <Svg width="100%" height={CONNECTOR_H} viewBox={`0 0 100 ${CONNECTOR_H}`} preserveAspectRatio="none">
        <Path
          d={d}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
    </View>
  );
}

// ─── Lesson row ───────────────────────────────────────────────────────────────
function LessonRow({ lesson, isActive, index }: { lesson: LessonNode; isActive: boolean; index: number }) {
  const isLeft = lesson.side === 'left';

  return (
    <View style={ss.lessonRow}>
      {isLeft ? (
        <>
          <View style={ss.cardWrap}>
            <LessonCard lesson={lesson} isActive={isActive} index={index} />
          </View>
          <View style={ss.badgeWrap}>
            {lesson.milestone && <MilestoneBadge badge={lesson.milestone} />}
          </View>
        </>
      ) : (
        <>
          <View style={ss.badgeWrap}>
            {lesson.milestone && <MilestoneBadge badge={lesson.milestone} />}
          </View>
          <View style={ss.cardWrap}>
            <LessonCard lesson={lesson} isActive={isActive} index={index} />
          </View>
        </>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function RoadmapScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const totalCoins = useCoins();
  const [lessons, setLessons] = useState<LessonNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCoinInfo, setShowCoinInfo] = useState(false);
  const [showCourseInfo, setShowCourseInfo] = useState(false);

  useEffect(() => {
    fetchMobileContent().then((mc) => {
      const c = mc.courses.find((x) => x.id === courseId) ?? mc.courses[0] ?? null;
      if (c) {
        const adminLessons = mc.lessons.filter((l) => l.courseId === c.id);
        const TOTAL_LESSONS = 72;
        const UNLOCKED_COUNT = 3;
        const mapped: LessonNode[] = Array.from({ length: TOTAL_LESSONS }, (_, i) => {
          const l = adminLessons[i];
          return {
            id: l?.id ?? String(i + 1),
            title: l?.name ?? `${i + 1}-dars`,
            subtitle: l?.isDemo ? 'Demo dars' : l?.isPaid ? 'Pullik' : '',
            type: (i % 2 === 0 ? 'grammar' : 'speaking') as LessonType,
            progress: 0,
            locked: i >= UNLOCKED_COUNT,
            side: i % 2 === 0 ? 'left' : 'right',
            stars: 0,
          };
        });
        setLessons(mapped);
      }
    }).finally(() => setLoading(false));
  }, [courseId]);

  // Joriy dars — ochilgan darslarning eng oxirgisi (frontier), progress darajasidan qat'i nazar.
  const unlockedCount = lessons.filter((l) => !l.locked).length;
  const activeIndex = unlockedCount - 1;
  const total = lessons.length;

  if (loading) {
    return (
      <SafeAreaView style={ss.safe} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  const courseTitle = "90 kunda gapiramiz";

  return (
    <SafeAreaView style={ss.safe} edges={['top']}>
      {/* ── Custom header ── */}
      <View style={ss.header}>
        <Pressable onPress={() => router.back()} style={ss.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>

        <Pressable style={ss.headerTitle} onPress={() => setShowCourseInfo(true)}>
          <Text style={ss.headerTitleText}>{courseTitle}</Text>
          <Ionicons name="chevron-down" size={16} color={theme.colors.text} />
        </Pressable>

        <View style={ss.headerRight}>
          <Pressable onPress={() => setShowCoinInfo(true)}>
            <CoinPill amount={totalCoins} />
          </Pressable>
        </View>
      </View>

      <CoinInfoModal visible={showCoinInfo} onClose={() => setShowCoinInfo(false)} />

      <Modal visible={showCourseInfo} animationType="fade" transparent onRequestClose={() => setShowCourseInfo(false)}>
        <View style={ss.dialogBackdrop}>
          <Pressable style={ss.dialogBackdropTap} onPress={() => setShowCourseInfo(false)} />
          <View style={ss.dialogCard}>
            <Text style={ss.dialogEmoji}>🚀</Text>
            <Text style={ss.dialogTitle}>90 kunda ingliz tilida gapiring</Text>
            <Text style={ss.dialogSubtitle}>
              📅 Har kuni videodars va speaking mashg'ulotlari almashinib boradi{'\n'}
              🗣️ 72 ta asosiy dars + 🎁 18 ta yakshanba bonus darsi{'\n'}
              🎯 Maqsad — 90 kun ichida ingliz tilida erkin va ishonch bilan gaplasha olish{'\n\n'}
              💪 Har bir kichik qadam katta natijaga olib boradi — bugun boshlang, ertaga o'zingizga rahmat aytasiz!
            </Text>
            <Pressable style={ss.dialogConfirmBtn} onPress={() => setShowCourseInfo(false)}>
              <Text style={ss.dialogConfirmText}>Zo'r, boshladik!</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.scroll}>
        {/* ── Section header ── */}
        <View style={ss.sectionHeader}>
          <Text style={ss.sectionTitle}>Darslar yo'li</Text>
          <Pressable style={ss.bonusBtn} onPress={() => router.push('/homework/bonus' as never)}>
            <Ionicons name="gift-outline" size={16} color="#D97706" />
            <Text style={ss.bonusBtnText}>Bonus darslar</Text>
          </Pressable>
        </View>

        {/* ── Lesson path ── */}
        <View style={ss.path}>
          {lessons.map((lesson, index) => {
            const isActive = index === activeIndex;
            const prevLesson = index > 0 ? lessons[index - 1] : null;
            const connectorCompleted = prevLesson ? (!prevLesson.locked && prevLesson.progress > 0) : false;

            return (
              <React.Fragment key={lesson.id}>
                {index > 0 && (
                  <PathConnector
                    fromSide={prevLesson!.side}
                    completed={connectorCompleted}
                  />
                )}
                <LessonRow lesson={lesson} isActive={isActive} index={index} />
              </React.Fragment>
            );
          })}

          {/* ── Final milestone ── */}
          {lessons.length > 0 && (
            <PathConnector
              fromSide={lessons[lessons.length - 1].side}
              toX={50}
              completed={!lessons[lessons.length - 1].locked && lessons[lessons.length - 1].progress > 0}
            />
          )}
          <View style={ss.finalMilestone}>
            <View style={ss.finalMilestoneCircle}>
              <Text style={ss.finalMilestoneFlag}>🏁</Text>
              <Text style={ss.finalMilestoneNum}>{total}</Text>
              <Text style={ss.finalMilestoneSub}>Dars {total}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CARD_FLEX = 3;
const BADGE_FLEX = 1;

const ss = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F2F8' },
  scroll: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  dialogBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogBackdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  dialogEmoji: { fontSize: 36 },
  dialogTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text, textAlign: 'center' },
  dialogSubtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'left', lineHeight: 20 },
  dialogConfirmBtn: {
    width: '100%',
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
  },
  dialogConfirmText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
  headerTitleText: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 6,
  },
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontFamily: theme.fonts.extraBold,
    fontSize: 20,
    color: theme.colors.text,
  },
  bonusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
  },
  bonusBtnText: {
    fontFamily: theme.fonts.semiBold,
    fontSize: 12,
    color: '#D97706',
  },

  // Path
  path: {
    paddingHorizontal: 16,
  },

  // Lesson row
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardWrap: {
    flex: CARD_FLEX,
  },
  badgeWrap: {
    flex: BADGE_FLEX,
    alignItems: 'center',
  },

  // Card
  card: {
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: theme.colors.surface,
    padding: 14,
    ...theme.shadow.card,
  },
  cardLocked: {
    opacity: 0.65,
  },
  activeGlowWrap: {
    borderRadius: 22,
    padding: 2,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  activeGlowInner: {
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    padding: 14,
  },
  activeBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.purple,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    ...theme.shadow.card,
  },
  activeBadgeText: { fontFamily: theme.fonts.bold, fontSize: 11, color: '#fff' },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },

  // Type badge
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontFamily: theme.fonts.semiBold,
    fontSize: 10,
  },

  // Status circle
  statusCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusDone: {
    backgroundColor: '#34D399',
  },
  statusActive: {
    backgroundColor: '#EDE9FE',
    borderWidth: 2,
    borderColor: theme.colors.purple,
  },
  statusDefault: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  statusLocked: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  statusNumActive: {
    fontFamily: theme.fonts.extraBold,
    fontSize: 16,
    color: theme.colors.purple,
  },
  statusNumDefault: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
    color: theme.colors.textMuted,
  },

  // Card content
  cardContent: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  completedNum: {
    fontFamily: theme.fonts.extraBold,
    fontSize: 18,
    color: '#34D399',
  },
  cardTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    color: theme.colors.text,
    flexShrink: 1,
  },
  cardTitleLocked: {
    color: theme.colors.textMuted,
  },
  cardTitleBonus: {
    color: '#D97706',
  },
  cardSubtitle: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  starsPercent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  coinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  coinRowText: {
    fontFamily: theme.fonts.semiBold,
    fontSize: 11,
    color: '#B45309',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  percentText: {
    fontFamily: theme.fonts.semiBold,
    fontSize: 12,
    color: theme.colors.purple,
  },

  // Milestone badge (side)
  milestoneBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  milestoneLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 9,
    textAlign: 'center',
  },
  milestoneSub: {
    fontFamily: theme.fonts.medium,
    fontSize: 8,
    textAlign: 'center',
  },

  // Connector
  connectorWrap: {
    height: CONNECTOR_H,
    justifyContent: 'center',
  },

  // Final milestone
  finalMilestone: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  finalMilestoneCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#EDE9FE',
    borderWidth: 3,
    borderColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  finalMilestoneFlag: {
    fontSize: 18,
  },
  finalMilestoneNum: {
    fontFamily: theme.fonts.extraBold,
    fontSize: 24,
    color: theme.colors.purple,
    lineHeight: 28,
  },
  finalMilestoneSub: {
    fontFamily: theme.fonts.medium,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
});
