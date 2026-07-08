import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaterialsList } from '@/components/ui/MaterialsList';
import { StudentProfileModal } from '@/components/StudentProfileModal';
import { theme } from '@/constants/theme';
import { getResolvedLessonContent, LessonContent } from '@/data/lessonContent';
import { useAvatarUri } from '@/services/avatarStore';
import { fetchMobileContent, getLessonMaterials, LessonMaterials } from '@/services/contentApi';
import { markDone } from '@/services/lessonProgressStore';
import { saveLastPosition } from '@/services/progressStore';

const { width } = Dimensions.get('window');

type Comment = { id: string; name: string; text: string; time: string; me?: boolean };

const MOCK_COMMENTS: Comment[] = [
  { id: 'c1', name: 'Kamola', text: "Slaydlar juda tushunarli tayyorlangan, rahmat!", time: '3 kun oldin' },
  { id: 'c2', name: 'Jasur', text: "Misollar ko'p bo'lgani yoqdi.", time: '1 kun oldin' },
  { id: 'c3', name: 'Nilufar', text: "Shu mavzuni takrorlash uchun juda foydali.", time: '6 soat oldin' },
];

export default function SlidesScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [content, setContent] = useState<LessonContent | null>(null);
  const [materials, setMaterials] = useState<LessonMaterials | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS);
  const [draft, setDraft] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const myAvatarUri = useAvatarUri();

  const submitComment = () => {
    const text = draft.trim();
    if (!text) return;
    setComments((prev) => [{ id: `me-${Date.now()}`, name: 'Siz', text, time: 'hozir', me: true }, ...prev]);
    setDraft('');
  };

  useEffect(() => {
    getResolvedLessonContent(String(lessonId), 1).then(setContent);
    fetchMobileContent().then((mc) => setMaterials(getLessonMaterials(mc, String(lessonId))));
  }, [lessonId]);

  useEffect(() => {
    markDone(String(lessonId), 'slidesWatch');
    saveLastPosition({ lessonId: String(lessonId), section: 'speaking/slides', label: "Slidelarni ko'rish" });
  }, [lessonId]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(idx);
  };

  if (!content) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.konspektSection}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  const slides = content.slides;

  const goTo = (idx: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, idx));
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    setActiveIndex(clamped);
  };

  const current = slides[activeIndex];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Slaydlar</Text>
        <Text style={styles.progress}>
          {activeIndex + 1} / {slides.length}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScrollEnd}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}>
        {slides.map((slide) => (
          <View key={slide.id} style={[styles.slidePage, { width }]}>
            <View style={styles.slideVisual}>
              <Ionicons name="easel-outline" size={48} color="#fff" />
              <Text style={styles.slideVisualTitle}>{slide.title}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.progressRow}>
        <View style={styles.dotsRow}>
          {slides.map((s, i) => (
            <Pressable key={s.id} onPress={() => goTo(i)} hitSlop={6}>
              <View style={[styles.dotItem, i === activeIndex && styles.dotItemActive]} />
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.commentsPill} onPress={() => setShowComments(true)}>
          <Ionicons name="chatbubble-ellipses-outline" size={15} color={theme.colors.purple} />
          <Text style={styles.commentsPillText}>Izohlar ({comments.length})</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.konspektSection} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Konspekt</Text>
        <Text style={styles.body}>{current.body}</Text>
        {materials && <MaterialsList files={materials.files} />}
      </ScrollView>

      <View style={styles.navRow}>
        <Pressable
          style={[styles.navBtn, activeIndex === 0 && styles.navBtnDisabled]}
          disabled={activeIndex === 0}
          onPress={() => goTo(activeIndex - 1)}>
          <Ionicons name="chevron-back" size={20} color={activeIndex === 0 ? theme.colors.textLight : theme.colors.purple} />
          <Text style={[styles.navBtnText, activeIndex === 0 && styles.navBtnTextDisabled]}>Oldingi</Text>
        </Pressable>
        {activeIndex === slides.length - 1 ? (
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneText}>Tugatish</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.nextNavBtn} onPress={() => goTo(activeIndex + 1)}>
            <Text style={styles.nextNavBtnText}>Keyingi</Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </Pressable>
        )}
      </View>

      <Modal visible={showComments} animationType="slide" transparent onRequestClose={() => setShowComments(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text },
  progress: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted },
  slidePage: { paddingHorizontal: 20 },
  slideVisual: {
    height: 200,
    backgroundColor: theme.colors.pink,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  slideVisualTitle: { fontFamily: theme.fonts.bold, fontSize: 16, color: '#fff' },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 14,
    gap: 8,
  },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dotItem: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.border },
  dotItemActive: { backgroundColor: theme.colors.pink, width: 20 },
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
  konspektSection: { paddingHorizontal: 20, paddingTop: 20, flex: 1 },
  sectionLabel: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple, marginBottom: 6 },
  body: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.textMuted, lineHeight: 24 },
  navRow: { flexDirection: 'row', gap: 12, padding: 20 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 14, paddingHorizontal: 10 },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.purple },
  navBtnTextDisabled: { color: theme.colors.textLight },
  nextNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
  },
  nextNavBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
  doneBtn: { flex: 1, backgroundColor: theme.colors.success, borderRadius: theme.radius.sm, paddingVertical: 14, alignItems: 'center' },
  doneText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },

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
