import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { getLevelForLightning } from '@/data/levels';
import { getRankedLeaderboard, profileStats } from '@/data/mock';
import { getStudentProfile } from '@/data/studentProfiles';
import { openThread } from '@/services/studentChatStore';

const MY_GENDER: 'male' | 'female' = profileStats.gender === 'Ayol' ? 'female' : 'male';

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon} size={16} color={theme.colors.purple} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export function StudentProfileModal({
  visible,
  onClose,
  studentName,
}: {
  visible: boolean;
  onClose: () => void;
  studentName: string | null;
}) {
  const { t } = useLang();
  const [showBlocked, setShowBlocked] = useState(false);

  if (!studentName) return null;
  const profile = getStudentProfile(studentName);
  const canMessage = profile.gender === MY_GENDER;
  const leaderboardEntry = getRankedLeaderboard('alltime', 'country').find((e) => e.name === profile.name);
  const leaderboardRank = leaderboardEntry?.rank;
  const level = getLevelForLightning(leaderboardEntry?.displayLightning ?? 0);

  const handleMessage = async () => {
    if (!canMessage) {
      setShowBlocked(true);
      return;
    }
    await openThread(profile);
    onClose();
    router.push(`/messages/student-${profile.id}` as never);
  };

  const handleClose = () => {
    setShowBlocked(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>{profile.avatarEmoji}</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.subLabel}>{t('spm_student_since').replace('{date}', profile.courseStartDate)}</Text>
            </View>
            {leaderboardEntry && (
              <View style={styles.levelBadge}>
                <Image source={level.image} style={styles.levelBadgeImage} />
                <Text style={styles.levelBadgeText} numberOfLines={1}>
                  {level.name}
                </Text>
              </View>
            )}
            {leaderboardRank !== undefined && (
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeEmoji}>🏆</Text>
                <Text style={styles.rankBadgeText}>{leaderboardRank}{t('profile_place_suffix')}</Text>
              </View>
            )}
          </View>

          {showBlocked && (
            <View style={styles.blockedBanner}>
              <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.danger} />
              <Text style={styles.blockedText}>
                {t('spm_blocked_text')}
              </Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <Text style={styles.sectionTitle}>{t('spm_section_course')}</Text>
            <View style={styles.card}>
              <Row icon="calendar-outline" label={t('spm_row_course_start')} value={profile.courseStartDate} />
              <Row icon="person-outline" label={t('spm_row_main_teacher')} value={profile.mainTeacher} />
              <Row icon="people-outline" label={t('spm_row_assistant_teacher')} value={profile.assistantTeacher} />
              <Row icon="videocam-outline" label={t('spm_row_video_teacher')} value={profile.videoTeacher} />
            </View>

            <Text style={styles.sectionTitle}>{t('spm_section_results')}</Text>
            <View style={styles.card}>
              <Row icon="trending-up-outline" label={t('hw_overall_progress')} value={`${profile.overallProgress}%`} />
              <Row icon="checkmark-circle-outline" label={t('profile_attendance')} value={`${profile.attendanceRate}%`} />
              <Row icon="star-outline" label={t('spm_row_avg_grade')} value={`${profile.avgGrade.toFixed(1)}/5`} />
              <Row icon="book-outline" label={t('spm_row_completed_lessons')} value={`${profile.lessonsCompleted} ${t('spm_count_suffix')}`} />
            </View>

            <Text style={styles.sectionTitle}>{t('spm_section_activity')}</Text>
            <View style={styles.card}>
              <Row icon="newspaper-outline" label={t('spm_row_community_posts')} value={`${profile.communityPostsCount} ${t('spm_count_suffix')}`} />
              <Row icon="chatbubble-outline" label={t('spm_row_comments_written')} value={`${profile.commentsCount} ${t('spm_count_suffix')}`} />
              <Row icon="heart-outline" label={t('spm_row_total_likes')} value={`${profile.totalLikes} ${t('spm_count_suffix')}`} />
              <Row icon="bag-handle-outline" label={t('spm_row_shop_purchases')} value={`${profile.shopPurchasesCount} ${t('spm_count_suffix')}`} />
            </View>
          </ScrollView>

          <Pressable style={styles.messageBtn} onPress={handleMessage}>
            <Ionicons name="chatbubbles" size={18} color="#fff" />
            <Text style={styles.messageBtnText}>{t('spm_message_btn')}</Text>
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
    maxHeight: '85%',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 14 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 26 },
  headerInfo: { flex: 1 },
  name: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text },
  subLabel: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  rankBadge: {
    alignItems: 'center',
    gap: 2,
    backgroundColor: theme.colors.warningBg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rankBadgeEmoji: { fontSize: 16 },
  rankBadgeText: { fontFamily: theme.fonts.bold, fontSize: 12, color: '#B45309' },
  levelBadge: {
    alignItems: 'center',
    gap: 2,
    backgroundColor: theme.colors.purpleLight,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 76,
  },
  levelBadgeImage: { width: 22, height: 22, resizeMode: 'contain' },
  levelBadgeText: { fontFamily: theme.fonts.bold, fontSize: 10, color: theme.colors.purple },

  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.dangerBg,
    borderRadius: theme.radius.sm,
    padding: 12,
    marginBottom: 12,
  },
  blockedText: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.danger, lineHeight: 17 },

  scroll: { paddingBottom: 8 },
  sectionTitle: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.textMuted, marginBottom: 8, marginTop: 4 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 6,
    marginBottom: 16,
    ...theme.shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10 },
  rowIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted },
  rowValue: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text, maxWidth: 160, textAlign: 'right' },

  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 15,
    marginTop: 8,
  },
  messageBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
