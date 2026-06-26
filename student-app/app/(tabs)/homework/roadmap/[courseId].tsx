import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { courses, roadmapLessons, LessonNode, LessonType } from '@/data/mock';

// ─── Type config ────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<LessonType, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> = {
  grammar: { icon: 'book-outline', color: '#7B61FF', bg: '#EDE9FE', label: 'Grammar' },
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
function LessonCard({ lesson, isActive }: { lesson: LessonNode; isActive: boolean }) {
  const isCompleted = !lesson.locked && lesson.progress > 0;
  const numText = lesson.id;

  const cardBorderColor = lesson.type === 'bonus' && !lesson.locked
    ? '#F59E0B'
    : isActive
      ? theme.colors.purple
      : isCompleted
        ? theme.colors.success
        : theme.colors.border;

  const cardBg = lesson.type === 'bonus' && !lesson.locked
    ? '#FFFBEB'
    : isActive
      ? '#F5F3FF'
      : theme.colors.surface;

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
      {/* Type badge */}
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
              <Text style={ss.percentText}>{lesson.progress}%</Text>
            </View>
          )}
        </View>

        {/* Chevron for active */}
        {isActive && (
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        )}
      </View>
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
function PathConnector({
  fromSide,
  completed,
}: {
  fromSide: 'left' | 'right';
  completed: boolean;
}) {
  const color = completed ? theme.colors.success : theme.colors.purpleLight;

  if (fromSide === 'left') {
    // Curve around the RIGHT side
    return (
      <View style={ss.connectorWrap}>
        <View
          style={[
            ss.connectorRight,
            { borderColor: color },
          ]}
        />
      </View>
    );
  }
  // Curve around the LEFT side
  return (
    <View style={ss.connectorWrap}>
      <View
        style={[
          ss.connectorLeft,
          { borderColor: color },
        ]}
      />
    </View>
  );
}

// ─── Lesson row ───────────────────────────────────────────────────────────────
function LessonRow({ lesson, isActive }: { lesson: LessonNode; isActive: boolean }) {
  const isLeft = lesson.side === 'left';

  return (
    <View style={ss.lessonRow}>
      {isLeft ? (
        <>
          <View style={ss.cardWrap}>
            <LessonCard lesson={lesson} isActive={isActive} />
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
            <LessonCard lesson={lesson} isActive={isActive} />
          </View>
        </>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function RoadmapScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const course = courses.find((c) => c.id === courseId) ?? courses[0];
  const lessons = roadmapLessons[course.id] ?? [];
  const activeIndex = lessons.findIndex((l) => !l.locked && l.progress > 0 && l.progress < 100);

  return (
    <SafeAreaView style={ss.safe} edges={['top']}>
      {/* ── Custom header ── */}
      <View style={ss.header}>
        <Pressable onPress={() => router.back()} style={ss.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>

        <View style={ss.headerTitle}>
          <Text style={ss.headerTitleText}>{course.title}</Text>
          <Ionicons name="chevron-down" size={16} color={theme.colors.text} />
        </View>

        <View style={ss.headerRight}>
          <View style={ss.statPill}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={ss.statPillText}>120</Text>
          </View>
          <View style={[ss.statPill, ss.statPillGold]}>
            <Text style={ss.statPillCoin}>$</Text>
            <Text style={ss.statPillText}>250</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.scroll}>
        {/* ── Progress banner ── */}
        <LinearGradient
          colors={['#4C3FDE', '#7B61FF', '#9E8FFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={ss.banner}
        >
          {/* Stars decoration */}
          <Text style={[ss.bannerStar, { top: 16, left: 100, fontSize: 10 }]}>✦</Text>
          <Text style={[ss.bannerStar, { top: 40, left: 160, fontSize: 7 }]}>✦</Text>
          <Text style={[ss.bannerStar, { top: 28, right: 130, fontSize: 8 }]}>✦</Text>

          <View style={ss.bannerLeft}>
            <Text style={ss.bannerLabel}>Umumiy progress</Text>
            <Text style={ss.bannerPercent}>{course.progress}%</Text>

            {/* Progress bar with bubble */}
            <View style={ss.bannerBarWrap}>
              {/* Floating bubble above indicator */}
              <View style={ss.bannerBubbleRow}>
                <View style={{ flex: course.progress, alignItems: 'flex-end' }}>
                  <View style={ss.bannerBubble}>
                    <Text style={ss.bannerBubbleText}>{course.progress}</Text>
                  </View>
                </View>
                <View style={{ flex: 100 - course.progress }} />
              </View>
              {/* Bar */}
              <View style={ss.bannerTrack}>
                <View style={[ss.bannerFill, { width: `${course.progress}%` }]} />
                <View style={[ss.bannerDot, { left: `${course.progress}%`, marginLeft: -6 }]} />
              </View>
            </View>

            <Text style={ss.bannerCount}>
              {course.lessonsDone} / {course.lessonsTotal} dars
            </Text>
          </View>

          {/* Rocket */}
          <View style={ss.bannerRocket}>
            <Text style={ss.rocketEmoji}>🚀</Text>
            <View style={ss.rocketGlow} />
          </View>
        </LinearGradient>

        {/* ── Section header ── */}
        <View style={ss.sectionHeader}>
          <Text style={ss.sectionTitle}>Darslar yo'li</Text>
          <View style={ss.sectionActions}>
            <Pressable style={ss.filterBtn}>
              <Text style={ss.filterText}>Barchasi</Text>
              <Ionicons name="chevron-down" size={15} color={theme.colors.text} />
            </Pressable>
            <Pressable style={ss.listToggleBtn}>
              <Ionicons name="list" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
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
                <LessonRow lesson={lesson} isActive={isActive} />
              </React.Fragment>
            );
          })}

          {/* ── Final milestone ── */}
          <View style={ss.finalConnector}>
            <View style={ss.finalConnectorLine} />
          </View>
          <View style={ss.finalMilestone}>
            <View style={ss.finalMilestoneCircle}>
              <Text style={ss.finalMilestoneFlag}>🏁</Text>
              <Text style={ss.finalMilestoneNum}>90</Text>
              <Text style={ss.finalMilestoneSub}>Dars 90</Text>
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
  headerTitleText: {
    fontFamily: theme.fonts.bold,
    fontSize: 17,
    color: theme.colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 6,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
  },
  statPillGold: {
    backgroundColor: '#FEF3C7',
  },
  statPillCoin: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: '#D97706',
  },
  statPillText: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: '#D97706',
  },

  // Banner
  banner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 140,
  },
  bannerLeft: {
    flex: 1,
  },
  bannerStar: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.6)',
  },
  bannerLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  bannerPercent: {
    fontFamily: theme.fonts.extraBold,
    fontSize: 42,
    color: '#fff',
    lineHeight: 50,
    marginBottom: 10,
  },
  bannerBarWrap: {
    marginRight: 12,
    marginBottom: 2,
  },
  bannerBubbleRow: {
    flexDirection: 'row',
    marginBottom: 4,
    height: 22,
  },
  bannerBubble: {
    width: 32,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -16,
  },
  bannerBubbleText: {
    fontFamily: theme.fonts.bold,
    fontSize: 11,
    color: theme.colors.purple,
  },
  bannerTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 99,
    overflow: 'visible',
    position: 'relative',
  },
  bannerFill: {
    height: 8,
    backgroundColor: '#4ADE80',
    borderRadius: 99,
  },
  bannerDot: {
    position: 'absolute',
    top: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    borderWidth: 2.5,
    borderColor: '#4ADE80',
  },
  bannerCount: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 10,
  },
  bannerRocket: {
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rocketEmoji: {
    fontSize: 64,
    transform: [{ rotate: '25deg' }],
  },
  rocketGlow: {
    position: 'absolute',
    bottom: -10,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,200,100,0.18)',
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
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterText: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    color: theme.colors.text,
  },
  listToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    height: 44,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  connectorRight: {
    // Wraps around the RIGHT side: from ~70% to 100%, C-shape open to left
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: '28%',
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    borderRightWidth: 2.5,
    borderTopWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: theme.colors.purpleLight,
  },
  connectorLeft: {
    // Wraps around the LEFT side
    position: 'absolute',
    left: 4,
    top: 0,
    bottom: 0,
    width: '28%',
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
    borderLeftWidth: 2.5,
    borderTopWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: theme.colors.purpleLight,
  },

  // Final milestone
  finalConnector: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finalConnectorLine: {
    width: 2.5,
    height: 36,
    backgroundColor: theme.colors.purpleLight,
    borderRadius: 2,
  },
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
