import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentProfileModal } from '@/components/StudentProfileModal';
import { theme } from '@/constants/theme';
import { getResolvedLessonContent, LessonContent } from '@/data/lessonContent';
import { useAvatarUri } from '@/services/avatarStore';
import { markDone } from '@/services/lessonProgressStore';
import { saveLastPosition } from '@/services/progressStore';

type Comment = { id: string; name: string; text: string; time: string; me?: boolean };

const MOCK_COMMENTS: Comment[] = [
  { id: 'c1', name: "Dilnoza", text: "Konspekt juda tushunarli yozilgan, rahmat!", time: '2 kun oldin' },
  { id: 'c2', name: "Sardor", text: "Formulani birinchi marta shu yerda tushundim.", time: '1 kun oldin' },
  { id: 'c3', name: "Madina", text: "Video sekinroq bo'lsa yanada yaxshi bo'lardi.", time: '5 soat oldin' },
];

export default function WatchVideoScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const isBonus = String(lessonId).startsWith('bonus-');
  const [content, setContent] = useState<LessonContent | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS);
  const [draft, setDraft] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const myAvatarUri = useAvatarUri();

  useEffect(() => {
    getResolvedLessonContent(String(lessonId), 0).then(setContent);
  }, [lessonId]);

  useEffect(() => {
    markDone(String(lessonId), 'videoWatch');
    saveLastPosition({ lessonId: String(lessonId), section: 'video/watch', label: 'Videodars' });
  }, [lessonId]);

  const submitComment = () => {
    const text = draft.trim();
    if (!text) return;
    setComments((prev) => [{ id: `me-${Date.now()}`, name: 'Siz', text, time: 'hozir', me: true }, ...prev]);
    setDraft('');
  };

  if (!content) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>{isBonus ? 'Bonus dars' : 'Video dars'}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isBonus && (
          <View style={styles.bonusBadge}>
            <Text style={styles.bonusBadgeText}>🎁 Yakshanba bonus darsi</Text>
          </View>
        )}

        <View style={[styles.videoPlaceholder, isBonus && styles.videoPlaceholderBonus]}>
          <View style={[styles.playBtn, isBonus && styles.playBtnBonus]}>
            <Ionicons name="play" size={36} color="#fff" />
          </View>
          <Text style={styles.videoDuration}>12:08</Text>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.unitTitle}>{content.unitTitle}</Text>
          <Pressable style={styles.commentsPill} onPress={() => setShowComments(true)}>
            <Ionicons name="chatbubble-ellipses-outline" size={15} color={theme.colors.purple} />
            <Text style={styles.commentsPillText}>Izohlar ({comments.length})</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Konspekt</Text>
          <Text style={styles.body}>{content.konspekt}</Text>
        </View>
      </ScrollView>

      <Pressable style={styles.doneBtn} onPress={() => router.back()}>
        <Text style={styles.doneText}>Ko'rdim</Text>
      </Pressable>

      <Modal visible={showComments} animationType="slide" transparent onRequestClose={() => setShowComments(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalBackdropTap} onPress={() => setShowComments(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Izohlar</Text>
            <ScrollView contentContainerStyle={styles.commentsList} showsVerticalScrollIndicator={false}>
              {comments.map((c) => (
                <View key={c.id} style={styles.commentRow}>
                  <Pressable onPress={() => !c.me && setSelectedStudent(c.name)}>
                    <View style={[styles.commentAvatar, c.me && styles.commentAvatarMe]}>
                      {c.me && myAvatarUri ? (
                        <Image source={{ uri: myAvatarUri }} style={styles.commentAvatarImage} />
                      ) : (
                        <Text style={styles.commentAvatarText}>{c.name.charAt(0)}</Text>
                      )}
                    </View>
                  </Pressable>
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeaderRow}>
                      <Pressable onPress={() => !c.me && setSelectedStudent(c.name)}>
                        <Text style={styles.commentName}>{c.name}</Text>
                      </Pressable>
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

      <StudentProfileModal visible={selectedStudent !== null} studentName={selectedStudent} onClose={() => setSelectedStudent(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text },
  scroll: { padding: 20, paddingBottom: 100 },
  bonusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 14,
  },
  bonusBadgeText: { fontFamily: theme.fonts.bold, fontSize: 12, color: '#B45309' },
  videoPlaceholder: {
    height: 200,
    backgroundColor: theme.colors.text,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  videoPlaceholderBonus: { backgroundColor: '#B45309' },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnBonus: { backgroundColor: 'rgba(255,255,255,0.3)' },
  videoDuration: { fontFamily: theme.fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
  unitTitle: { flex: 1, fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.text },
  commentsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.colors.purpleLight,
  },
  commentsPillText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.purple },
  section: { marginBottom: 20 },
  sectionLabel: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple, marginBottom: 6 },
  body: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.textMuted, lineHeight: 24 },
  doneBtn: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneText: { fontFamily: theme.fonts.bold, fontSize: 16, color: '#fff' },

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
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: theme.colors.text, marginBottom: 12 },
  commentsList: { paddingBottom: 12, gap: 14 },
  commentRow: { flexDirection: 'row', gap: 10 },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  commentAvatarMe: { backgroundColor: theme.colors.purple },
  commentAvatarImage: { width: 34, height: 34 },
  commentAvatarText: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.purple },
  commentBody: { flex: 1 },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentName: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text },
  commentTime: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textLight },
  commentText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
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
  commentSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
