import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentsSheet } from '@/components/CommentsSheet';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { profileStats } from '@/data/mock';
import { TEACHER_PROFILES, TeacherProfile } from '@/data/teacherProfiles';
import { fetchDemoGrades } from '@/services/contentApi';

const TELEGRAM_GROUP_URL = 'https://t.me/myhomeworkuz';

function formatRating(rating: number): string {
  return rating.toFixed(1).replace('.', ',');
}

type TeacherCardProps = {
  profile: TeacherProfile;
  onMessage?: () => void;
  onGroup?: () => void;
  onHelp?: () => void;
  onComments?: () => void;
};

function TeacherCard({ profile, onMessage, onGroup, onHelp, onComments }: TeacherCardProps) {
  return (
    <View style={styles.cardWrap}>
      <Text style={styles.categoryLabel}>{profile.categoryLabel.toUpperCase()}</Text>
      <Card style={styles.card}>
        <View style={styles.headRow}>
          <View style={[styles.avatar, { backgroundColor: profile.colors[0] }]}>
            <Text style={styles.avatarEmoji}>{profile.emoji}</Text>
          </View>
          <View style={styles.headInfo}>
            <Text style={styles.name}>{profile.name}</Text>
            <View style={styles.badgeRow}>
              <Text style={styles.flag}>{profile.flag}</Text>
              <View style={styles.levelPill}>
                <Text style={styles.levelPillText}>{profile.level}</Text>
              </View>
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={11} color="#D97706" />
                <Text style={styles.ratingPillText}>{formatRating(profile.rating)}</Text>
              </View>
              {profile.verified && <Ionicons name="shield-checkmark" size={18} color={theme.colors.blue} />}
            </View>
          </View>
        </View>

        <Text style={styles.quote}>"{profile.quote}"</Text>
        <Text style={styles.quoteAuthor}>{profile.quoteAuthor}</Text>

        {profile.hasActions && (
          <>
            <View style={styles.divider} />
            <View style={styles.actionsRow}>
              <Pressable style={styles.actionBtn} onPress={onMessage}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.colors.purple} />
                <Text style={styles.actionLabel}>Xabar</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={onGroup}>
                <Ionicons name="paper-plane-outline" size={20} color={theme.colors.purple} />
                <Text style={styles.actionLabel}>Guruh</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={onHelp}>
                <Ionicons name="call-outline" size={20} color={theme.colors.purple} />
                <Text style={styles.actionLabel}>Yordam</Text>
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={onComments}>
                <Ionicons name="chatbox-ellipses-outline" size={20} color={theme.colors.purple} />
                <Text style={styles.actionLabel}>Izohlar</Text>
              </Pressable>
            </View>
          </>
        )}
      </Card>
    </View>
  );
}

export default function TeacherScreen() {
  const videoTeacher = TEACHER_PROFILES.find((t) => t.id === 'video-teacher')!;
  const assistantTeacher = TEACHER_PROFILES.find((t) => t.id === 'assistant-teacher')!;

  // Asosiy ustozning reytingi endi o'quvchilar CRM orqali haqiqatda bergan
  // "Siz ustozni baholang" baholarining o'rtachasi — hali haqiqiy baho
  // bo'lmasa, mock qiymatga tushadi.
  const mainTeacherBase = TEACHER_PROFILES.find((t) => t.id === 'main-teacher')!;
  const [realRating, setRealRating] = useState<number | null>(null);
  useEffect(() => {
    fetchDemoGrades()
      .then(({ teacherRating }) => setRealRating(teacherRating))
      .catch(() => {});
  }, []);
  const mainTeacher = realRating !== null ? { ...mainTeacherBase, rating: realRating } : mainTeacherBase;

  const [activeSheet, setActiveSheet] = useState<'main' | 'assistant' | null>(null);
  const activeTeacher = activeSheet === 'main' ? mainTeacher : activeSheet === 'assistant' ? assistantTeacher : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Mening ustozim" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TeacherCard profile={videoTeacher} />
        <TeacherCard
          profile={mainTeacher}
          onMessage={() => router.push(`/messages/${mainTeacher.chatId}` as never)}
          onGroup={() => Linking.openURL(TELEGRAM_GROUP_URL)}
          onHelp={() => Linking.openURL(`tel:${profileStats.phone}`)}
          onComments={() => setActiveSheet('main')}
        />
        <TeacherCard
          profile={assistantTeacher}
          onMessage={() => router.push(`/messages/${assistantTeacher.chatId}` as never)}
          onGroup={() => Linking.openURL(TELEGRAM_GROUP_URL)}
          onHelp={() => Linking.openURL(`tel:${profileStats.phone}`)}
          onComments={() => setActiveSheet('assistant')}
        />
      </ScrollView>

      <CommentsSheet
        visible={activeSheet !== null}
        onClose={() => setActiveSheet(null)}
        category="teacher"
        itemId={activeTeacher?.id ?? ''}
        itemLabel={activeTeacher?.name ?? ''}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 20, paddingBottom: 40, gap: 20 },

  cardWrap: {},
  categoryLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 11,
    color: theme.colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  card: {},
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarEmoji: { fontSize: 30 },
  headInfo: { flex: 1 },
  name: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: theme.colors.text, marginBottom: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  flag: { fontSize: 16 },
  levelPill: { backgroundColor: theme.colors.blueLight, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  levelPillText: { fontFamily: theme.fonts.semiBold, fontSize: 11, color: theme.colors.blue },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.warningBg,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingPillText: { fontFamily: theme.fonts.semiBold, fontSize: 11, color: '#D97706' },

  quote: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.text, fontStyle: 'italic', marginTop: 16, lineHeight: 20 },
  quoteAuthor: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 4, fontStyle: 'italic' },

  divider: { height: 1, backgroundColor: theme.colors.border, marginTop: 18, marginBottom: 14 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { alignItems: 'center', gap: 6, flex: 1 },
  actionLabel: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.textMuted },
});
