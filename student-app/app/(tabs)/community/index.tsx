import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StudentProfileModal } from '@/components/StudentProfileModal';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { CommunityPost, timeAgo, toggleLikePost, usePosts } from '@/services/communityStore';

function PostCard({ post, onAuthorPress }: { post: CommunityPost; onAuthorPress: (name: string) => void }) {
  const commentCount = post.comments.length;

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
          <Text style={styles.avatarEmoji}>{post.authorEmoji}</Text>
        </View>
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.authorName}>{post.authorName}</Text>
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

export default function CommunityScreen() {
  const posts = usePosts();
  const [showInfo, setShowInfo] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Hamjamiyat"
        showBack
        rightAction={
          <Pressable style={styles.infoBtn} onPress={() => setShowInfo(true)} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={22} color={theme.colors.textMuted} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onAuthorPress={setSelectedStudent} />
        ))}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
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
  },
  avatarEmoji: { fontSize: 18 },
  cardHeaderInfo: { flex: 1 },
  authorName: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.text },
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
});
