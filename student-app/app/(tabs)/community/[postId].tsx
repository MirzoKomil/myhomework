import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentProfileModal } from '@/components/StudentProfileModal';
import { theme } from '@/constants/theme';
import { useAvatarUri } from '@/services/avatarStore';
import {
  CommunityComment,
  addComment,
  timeAgo,
  toggleLikeComment,
  toggleLikePost,
  usePost,
} from '@/services/communityStore';

function CommentRow({
  comment,
  isReply,
  onReply,
  onAuthorPress,
}: {
  comment: CommunityComment;
  isReply?: boolean;
  onReply?: (comment: CommunityComment) => void;
  onAuthorPress: (name: string) => void;
}) {
  const myAvatarUri = useAvatarUri();
  return (
    <View style={[styles.commentRow, isReply && styles.replyRow]}>
      <Pressable onPress={() => !comment.me && onAuthorPress(comment.authorName)}>
        <View style={styles.commentAvatar}>
          {comment.me && myAvatarUri ? (
            <Image source={{ uri: myAvatarUri }} style={styles.commentAvatarImage} />
          ) : (
            <Text style={styles.commentAvatarEmoji}>{comment.authorEmoji}</Text>
          )}
        </View>
      </Pressable>
      <View style={styles.commentBody}>
        <Pressable onPress={() => !comment.me && onAuthorPress(comment.authorName)} hitSlop={4}>
          <Text style={styles.commentName}>{comment.authorName}</Text>
        </Pressable>
        <Text style={styles.commentTime}>{timeAgo(comment.createdAt)}</Text>
        <Text style={styles.commentText}>{comment.text}</Text>
        <View style={styles.commentActions}>
          <Pressable style={styles.commentActionBtn} onPress={() => toggleLikeComment(comment.postId, comment.id)} hitSlop={6}>
            <Ionicons
              name={comment.likedByMe ? 'heart' : 'heart-outline'}
              size={15}
              color={comment.likedByMe ? theme.colors.danger : theme.colors.textMuted}
            />
            <Text style={styles.commentActionText}>{comment.likeCount}</Text>
          </Pressable>
          {!isReply && onReply && (
            <Pressable style={styles.commentActionBtn} onPress={() => onReply(comment)} hitSlop={6}>
              <Ionicons name="return-down-forward-outline" size={15} color={theme.colors.textMuted} />
              <Text style={styles.commentActionText}>Javob qaytarish</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export default function PostDetailScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const post = usePost(String(postId));
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const myAvatarUri = useAvatarUri();

  if (!post) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.topTitle}>post</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
    );
  }

  const topLevelComments = post.comments.filter((c) => !c.parentId);
  const repliesOf = (commentId: string) => post.comments.filter((c) => c.parentId === commentId);

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const handleShare = async () => {
    const message = post.text.slice(0, 120);
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
    }
  };

  const submitComment = async () => {
    const text = draft.trim();
    if (!text) return;
    await addComment(post.id, text, replyTo ? replyTo.id : null);
    setDraft('');
    setReplyTo(null);
    if (replyTo) setExpandedReplies((prev) => new Set(prev).add(replyTo.id));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>post</Text>
        <Pressable onPress={handleShare} hitSlop={12}>
          <Ionicons name="share-outline" size={22} color={theme.colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Pressable
            style={styles.postHeader}
            onPress={() => !post.me && setSelectedStudent(post.authorName)}>
            <View style={styles.avatar}>
              {post.me && myAvatarUri ? (
                <Image source={{ uri: myAvatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarEmoji}>{post.authorEmoji}</Text>
              )}
            </View>
            <View style={styles.postHeaderInfo}>
              <Text style={styles.authorName}>{post.authorName}</Text>
              <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
            </View>
          </Pressable>

          <Text style={styles.postText}>{post.text}</Text>
          {post.imageUri && <Image source={{ uri: post.imageUri }} style={styles.postImage} />}

          <View style={styles.engageRow}>
            <Pressable style={styles.engageBtn} onPress={() => toggleLikePost(post.id)} hitSlop={6}>
              <Ionicons
                name={post.likedByMe ? 'heart' : 'heart-outline'}
                size={19}
                color={post.likedByMe ? theme.colors.danger : theme.colors.textMuted}
              />
              <Text style={styles.engageText}>{post.likeCount}</Text>
            </Pressable>
            <View style={styles.engageBtn}>
              <Ionicons name="chatbubble-outline" size={18} color={theme.colors.textMuted} />
              <Text style={styles.engageText}>{post.comments.length}</Text>
            </View>
            <View style={styles.engageBtn}>
              <Ionicons name="eye-outline" size={19} color={theme.colors.textMuted} />
              <Text style={styles.engageText}>{post.viewCount}</Text>
            </View>
          </View>

          <Text style={styles.commentsTitle}>Bildirilgan fikrlar</Text>

          {topLevelComments.length === 0 && <Text style={styles.emptyText}>Hali izohlar yo'q. Birinchi bo'ling!</Text>}

          {topLevelComments.map((comment) => {
            const replies = repliesOf(comment.id);
            const isExpanded = expandedReplies.has(comment.id);
            return (
              <View key={comment.id}>
                <CommentRow comment={comment} onReply={setReplyTo} onAuthorPress={setSelectedStudent} />
                {replies.length > 0 && (
                  <Pressable style={styles.toggleRepliesBtn} onPress={() => toggleReplies(comment.id)}>
                    <Text style={styles.toggleRepliesText}>
                      {isExpanded ? "Javoblarni yashirish" : `Javoblarni ko'rish (${replies.length})`}
                    </Text>
                  </Pressable>
                )}
                {isExpanded &&
                  replies.map((reply) => (
                    <CommentRow key={reply.id} comment={reply} isReply onAuthorPress={setSelectedStudent} />
                  ))}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.inputArea}>
          {replyTo && (
            <View style={styles.replyingRow}>
              <Text style={styles.replyingText}>
                Javob: <Text style={styles.replyingName}>{replyTo.authorName}</Text>
              </Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                <Ionicons name="close" size={16} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Fikringizni bildiring..."
              placeholderTextColor={theme.colors.textLight}
              value={draft}
              onChangeText={setDraft}
              multiline
            />
            <Pressable style={styles.commentSendBtn} onPress={submitComment}>
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <StudentProfileModal visible={selectedStudent !== null} studentName={selectedStudent} onClose={() => setSelectedStudent(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  topTitle: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  scroll: { padding: 20, paddingBottom: 20 },

  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 42, height: 42 },
  avatarEmoji: { fontSize: 19 },
  postHeaderInfo: { flex: 1 },
  authorName: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.text },
  timeText: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textLight, marginTop: 1 },
  postText: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.text, lineHeight: 22, marginBottom: 12 },
  postImage: { width: '100%', height: 220, borderRadius: theme.radius.sm, marginBottom: 12 },

  engageRow: {
    flexDirection: 'row',
    gap: 22,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 18,
  },
  engageBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  engageText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.textMuted },

  commentsTitle: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text, marginBottom: 14 },
  emptyText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted },

  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  replyRow: { marginLeft: 30, marginTop: 10 },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  commentAvatarImage: { width: 34, height: 34 },
  commentAvatarEmoji: { fontSize: 15 },
  commentBody: { flex: 1 },
  commentName: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text },
  commentTime: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textLight, marginTop: 1 },
  commentText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.text, marginTop: 4, lineHeight: 19 },
  commentActions: { flexDirection: 'row', gap: 18, marginTop: 6 },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentActionText: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.textMuted },

  toggleRepliesBtn: { marginLeft: 44, marginTop: 8, marginBottom: 4 },
  toggleRepliesText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.purple },

  inputArea: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  replyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.purpleLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  replyingText: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted },
  replyingName: { fontFamily: theme.fonts.bold, color: theme.colors.purple },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  commentInput: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.text,
    maxHeight: 100,
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
