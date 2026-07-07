import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentProfileModal } from '@/components/StudentProfileModal';
import { CoinPill } from '@/components/ui/CoinIcon';
import { theme } from '@/constants/theme';
import { useAvatarUri } from '@/services/avatarStore';
import { CommunityPost, timeAgo, toggleLikePost, usePosts } from '@/services/communityStore';
import { useCoins } from '@/services/coinsStore';

type Filter = 'all' | 'popular' | 'official';

function PostCard({ post, onAuthorPress }: { post: CommunityPost; onAuthorPress: (name: string) => void }) {
  const commentCount = post.comments.length;
  const myAvatarUri = useAvatarUri();

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/community/${post.id}` as never)}>
      <Pressable
        style={styles.cardHeader}
        onPress={(e) => {
          if (post.me) return;
          e.stopPropagation();
          onAuthorPress(post.authorName);
        }}>
        <View style={styles.avatar}>
          {post.me && myAvatarUri ? (
            <Image source={{ uri: myAvatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarEmoji}>{post.authorEmoji}</Text>
          )}
        </View>
        <View style={styles.cardHeaderInfo}>
          <View style={styles.authorRow}>
            <Text style={styles.authorName}>{post.authorName}</Text>
            {post.official && (
              <View style={styles.officialBadge}>
                <Ionicons name="checkmark-circle" size={12} color={theme.colors.blue} />
                <Text style={styles.officialBadgeText}>Rasmiy</Text>
              </View>
            )}
          </View>
          <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
        </View>
      </Pressable>

      <Text style={styles.postText} numberOfLines={6}>
        {post.text}
      </Text>

      {post.imageUri && <Image source={{ uri: post.imageUri }} style={styles.postImage} />}

      <View style={styles.engageRow}>
        <Pressable style={styles.engageBtn} onPress={() => toggleLikePost(post.id)} hitSlop={6}>
          <Ionicons
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={18}
            color={post.likedByMe ? theme.colors.danger : theme.colors.textMuted}
          />
          <Text style={styles.engageText}>{post.likeCount}</Text>
        </Pressable>
        <View style={styles.engageBtn}>
          <Ionicons name="chatbubble-outline" size={17} color={theme.colors.textMuted} />
          <Text style={styles.engageText}>{commentCount}</Text>
        </View>
        <View style={styles.engageBtn}>
          <Ionicons name="eye-outline" size={18} color={theme.colors.textMuted} />
          <Text style={styles.engageText}>{post.viewCount}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Hammasi',
  popular: '🔥 Mashhur',
  official: '✅ Rasmiy',
};

export default function CommunityScreen() {
  const posts = usePosts();
  const coins = useCoins();
  const [showInfo, setShowInfo] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const displayedPosts = useMemo(() => {
    if (filter === 'popular') {
      return [...posts].sort((a, b) => b.likeCount + b.comments.length - (a.likeCount + a.comments.length));
    }
    if (filter === 'official') {
      return posts.filter((p) => p.official);
    }
    return posts;
  }, [posts, filter]);

  const activity = useMemo(() => {
    const myPosts = posts.filter((p) => p.me);
    const likes = myPosts.map((p) => ({ postId: p.id, postText: p.text, likeCount: p.likeCount }));

    const comments: { postId: string; postText: string; authorName: string; authorEmoji: string; text: string }[] = [];
    myPosts.forEach((p) => {
      p.comments.forEach((c) => {
        if (!c.me) comments.push({ postId: p.id, postText: p.text, authorName: c.authorName, authorEmoji: c.authorEmoji, text: c.text });
      });
    });

    const myCommentIds = new Set<string>();
    posts.forEach((p) => p.comments.forEach((c) => c.me && myCommentIds.add(c.id)));

    const replies: { postId: string; myCommentText: string; authorName: string; authorEmoji: string; text: string }[] = [];
    posts.forEach((p) => {
      p.comments.forEach((c) => {
        if (c.parentId && myCommentIds.has(c.parentId) && !c.me) {
          const myComment = p.comments.find((mc) => mc.id === c.parentId);
          replies.push({ postId: p.id, myCommentText: myComment?.text ?? '', authorName: c.authorName, authorEmoji: c.authorEmoji, text: c.text });
        }
      });
    });

    return { likes, comments, replies };
  }, [posts]);

  const goToPost = (postId: string) => {
    setShowActivity(false);
    router.push(`/community/${postId}` as never);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Hamjamiyat</Text>
        <View style={styles.headerRight}>
          <Pressable style={styles.heartBtn} onPress={() => setShowActivity(true)} hitSlop={8}>
            <Ionicons name="heart-outline" size={20} color={theme.colors.danger} />
          </Pressable>
          <CoinPill amount={coins} />
          <Pressable style={styles.infoBtn} onPress={() => setShowInfo(true)} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'popular', 'official'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}>
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>{FILTER_LABELS[f]}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {displayedPosts.length === 0 ? (
          <Text style={styles.emptyText}>Bu bo'limda hali postlar yo'q.</Text>
        ) : (
          displayedPosts.map((post) => <PostCard key={post.id} post={post} onAuthorPress={setSelectedStudent} />)
        )}
      </ScrollView>

      <StudentProfileModal visible={selectedStudent !== null} studentName={selectedStudent} onClose={() => setSelectedStudent(null)} />

      <Pressable style={styles.fab} onPress={() => router.push('/community/new' as never)}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      <Modal visible={showInfo} animationType="fade" transparent onRequestClose={() => setShowInfo(false)}>
        <View style={styles.dialogBackdrop}>
          <Pressable style={styles.dialogBackdropTap} onPress={() => setShowInfo(false)} />
          <View style={styles.dialogCard}>
            <Text style={styles.dialogEmoji}>💡</Text>
            <Text style={styles.dialogTitle}>Hamjamiyat nima uchun kerak?</Text>
            <Text style={styles.dialogSubtitle}>
              Bu yerda boshqa o'quvchilar bilan tajriba almashishingiz, savol berishingiz, yutuqlaringiz bilan
              bo'lishishingiz mumkin. Postlarga izoh yozing, izohlarga javob bering, yoqqan post yoki izohga
              like bosing.{'\n\n'}
              ✍️ <Text style={styles.dialogBold}>Har bir post uchun 1 coin</Text> qo'lga kiritasiz — o'zingiz
              yozgan har bir yangi post uchun avtomatik hisoblanadi.
            </Text>
            <Pressable style={styles.dialogBtn} onPress={() => setShowInfo(false)}>
              <Text style={styles.dialogBtnText}>Tushunarli</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showActivity} animationType="slide" transparent onRequestClose={() => setShowActivity(false)}>
        <View style={styles.actBackdrop}>
          <Pressable style={styles.actBackdropTap} onPress={() => setShowActivity(false)} />
          <View style={styles.actSheet}>
            <View style={styles.actHandle} />
            <Text style={styles.actTitle}>❤️ Faolligim</Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.actScroll}>
              <Text style={styles.actSectionTitle}>Postlaringizga kelgan like'lar</Text>
              {activity.likes.length === 0 ? (
                <Text style={styles.actEmpty}>Hali postingiz yo'q.</Text>
              ) : (
                activity.likes.map((l) => (
                  <Pressable key={l.postId} style={styles.actLikeRow} onPress={() => goToPost(l.postId)}>
                    <Ionicons name="heart" size={16} color={theme.colors.danger} />
                    <Text style={styles.actLikeText} numberOfLines={1}>
                      {l.postText}
                    </Text>
                    <Text style={styles.actLikeCount}>{l.likeCount}</Text>
                  </Pressable>
                ))
              )}

              <Text style={styles.actSectionTitle}>Postlaringizga yozilgan izohlar</Text>
              {activity.comments.length === 0 ? (
                <Text style={styles.actEmpty}>Hali izoh yo'q.</Text>
              ) : (
                activity.comments.map((c, i) => (
                  <Pressable key={i} style={styles.actCommentRow} onPress={() => goToPost(c.postId)}>
                    <Text style={styles.actCommentAuthor}>
                      {c.authorEmoji} {c.authorName}
                    </Text>
                    <Text style={styles.actCommentText} numberOfLines={2}>
                      {c.text}
                    </Text>
                    <Text style={styles.actCommentMeta} numberOfLines={1}>
                      Postingizga: "{c.postText}"
                    </Text>
                  </Pressable>
                ))
              )}

              <Text style={styles.actSectionTitle}>Izohlaringizga javoblar</Text>
              {activity.replies.length === 0 ? (
                <Text style={styles.actEmpty}>Hali javob yo'q.</Text>
              ) : (
                activity.replies.map((r, i) => (
                  <Pressable key={i} style={styles.actCommentRow} onPress={() => goToPost(r.postId)}>
                    <Text style={styles.actCommentAuthor}>
                      {r.authorEmoji} {r.authorName}
                    </Text>
                    <Text style={styles.actCommentText} numberOfLines={2}>
                      {r.text}
                    </Text>
                    <Text style={styles.actCommentMeta} numberOfLines={1}>
                      Izohingizga: "{r.myCommentText}"
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>

            <Pressable style={styles.actCloseBtn} onPress={() => setShowActivity(false)}>
              <Text style={styles.actCloseBtnText}>Yopish</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  headerTitle: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 18, color: theme.colors.text, textAlign: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  heartBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: { backgroundColor: theme.colors.purple, borderColor: theme.colors.purple },
  filterChipText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.textMuted },
  filterChipTextActive: { color: '#fff' },
  emptyText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  scroll: { padding: 20, paddingTop: 8, paddingBottom: 100, gap: 14 },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    ...theme.shadow.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 40, height: 40 },
  avatarEmoji: { fontSize: 18 },
  cardHeaderInfo: { flex: 1 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authorName: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.text },
  officialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.blueLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  officialBadgeText: { fontFamily: theme.fonts.bold, fontSize: 10, color: theme.colors.blue },
  timeText: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textLight, marginTop: 1 },
  postText: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.text, lineHeight: 21, marginBottom: 10 },
  postImage: { width: '100%', height: 180, borderRadius: theme.radius.sm, marginBottom: 10 },

  engageRow: { flexDirection: 'row', gap: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  engageBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  engageText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.textMuted },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
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
  dialogBold: { fontFamily: theme.fonts.semiBold, color: theme.colors.text },
  dialogBtn: {
    width: '100%',
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
  },
  dialogBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },

  actBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  actBackdropTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  actSheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 12 },
  actTitle: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: theme.colors.text, marginBottom: 12 },
  actScroll: { paddingBottom: 8 },
  actSectionTitle: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.textMuted, marginBottom: 8, marginTop: 12 },
  actEmpty: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textLight, marginBottom: 4 },
  actLikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: 12,
    marginBottom: 8,
  },
  actLikeText: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.text },
  actLikeCount: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.danger },
  actCommentRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: 12,
    marginBottom: 8,
    gap: 3,
  },
  actCommentAuthor: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.text },
  actCommentText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.text, lineHeight: 18 },
  actCommentMeta: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textLight, marginTop: 2 },
  actCloseBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  actCloseBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
