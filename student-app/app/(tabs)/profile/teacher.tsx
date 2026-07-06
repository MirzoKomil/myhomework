import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { profileStats } from '@/data/mock';
import {
  ASSISTANT_TEACHER_COMMENTS,
  MAIN_TEACHER_COMMENTS,
  TEACHER_PROFILES,
  TeacherComment,
  TeacherProfile,
} from '@/data/teacherProfiles';

const TELEGRAM_GROUP_URL = 'https://t.me/myhomeworkuz';

function formatRating(rating: number): string {
  return rating.toFixed(1).replace('.', ',');
}

type TeacherCardProps = {
  profile: TeacherProfile;
  commentsCount?: number;
  onMessage?: () => void;
  onGroup?: () => void;
  onHelp?: () => void;
  onComments?: () => void;
};

function TeacherCard({ profile, commentsCount, onMessage, onGroup, onHelp, onComments }: TeacherCardProps) {
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
                <View>
                  <Ionicons name="chatbox-ellipses-outline" size={20} color={theme.colors.purple} />
                  {!!commentsCount && (
                    <View style={styles.commentBadge}>
                      <Text style={styles.commentBadgeText}>{commentsCount}</Text>
                    </View>
                  )}
                </View>
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
  const mainTeacher = TEACHER_PROFILES.find((t) => t.id === 'main-teacher')!;
  const assistantTeacher = TEACHER_PROFILES.find((t) => t.id === 'assistant-teacher')!;

  const [mainComments, setMainComments] = useState<TeacherComment[]>(MAIN_TEACHER_COMMENTS);
  const [assistantComments, setAssistantComments] = useState<TeacherComment[]>(ASSISTANT_TEACHER_COMMENTS);
  const [activeSheet, setActiveSheet] = useState<'main' | 'assistant' | null>(null);
  const [draft, setDraft] = useState('');

  const activeComments = activeSheet === 'main' ? mainComments : activeSheet === 'assistant' ? assistantComments : [];
  const activeTeacher = activeSheet === 'main' ? mainTeacher : activeSheet === 'assistant' ? assistantTeacher : null;

  const submitComment = () => {
    const text = draft.trim();
    if (!text || !activeSheet) return;
    const newComment: TeacherComment = { id: `me-${Date.now()}`, name: 'Siz', text, time: 'hozir', me: true };
    if (activeSheet === 'main') setMainComments((prev) => [newComment, ...prev]);
    else setAssistantComments((prev) => [newComment, ...prev]);
    setDraft('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Mening ustozim" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TeacherCard profile={videoTeacher} />
        <TeacherCard
          profile={mainTeacher}
          commentsCount={mainComments.length}
          onMessage={() => router.push(`/messages/${mainTeacher.chatId}` as never)}
          onGroup={() => Linking.openURL(TELEGRAM_GROUP_URL)}
          onHelp={() => Linking.openURL(`tel:${profileStats.phone}`)}
          onComments={() => setActiveSheet('main')}
        />
        <TeacherCard
          profile={assistantTeacher}
          commentsCount={assistantComments.length}
          onMessage={() => router.push(`/messages/${assistantTeacher.chatId}` as never)}
          onGroup={() => Linking.openURL(TELEGRAM_GROUP_URL)}
          onHelp={() => Linking.openURL(`tel:${profileStats.phone}`)}
          onComments={() => setActiveSheet('assistant')}
        />
      </ScrollView>

      <Modal visible={!!activeSheet} animationType="slide" transparent onRequestClose={() => setActiveSheet(null)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalBackdropTap} onPress={() => setActiveSheet(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{activeTeacher?.name} — Izohlar</Text>
            <ScrollView contentContainerStyle={styles.commentsList} showsVerticalScrollIndicator={false}>
              {activeComments.map((c) => (
                <View key={c.id} style={styles.commentRow}>
                  <View style={[styles.commentAvatar, c.me && styles.commentAvatarMe]}>
                    <Text style={styles.commentAvatarText}>{c.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeaderRow}>
                      <Text style={styles.commentName}>{c.name}</Text>
                      <Text style={styles.commentTime}>{c.time}</Text>
                    </View>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Izoh qoldiring..."
                placeholderTextColor={theme.colors.textLight}
                value={draft}
                onChangeText={setDraft}
              />
              <Pressable style={styles.commentSendBtn} onPress={submitComment}>
                <Ionicons name="send" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  commentBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  commentBadgeText: { fontFamily: theme.fonts.bold, fontSize: 9, color: '#fff' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBackdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontFamily: theme.fonts.extraBold, fontSize: 17, color: theme.colors.text, marginBottom: 12 },
  commentsList: { paddingBottom: 12, gap: 14 },
  commentRow: { flexDirection: 'row', gap: 10 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.purpleLight, alignItems: 'center', justifyContent: 'center' },
  commentAvatarMe: { backgroundColor: theme.colors.purple },
  commentAvatarText: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.purple },
  commentBody: { flex: 1 },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentName: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text },
  commentTime: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textLight },
  commentText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  commentInput: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.text,
  },
  commentSendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.purple, alignItems: 'center', justifyContent: 'center' },
});
