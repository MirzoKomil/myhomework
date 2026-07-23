import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { useCommunityActivity } from '@/services/communityStore';

export function ActivityModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useLang();
  const activity = useCommunityActivity();

  const goToPost = (postId: string) => {
    onClose();
    router.push(`/community/${postId}` as never);
  };

  const goToCommunity = () => {
    onClose();
    router.push('/community' as never);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('act_title')}</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <Text style={styles.sectionTitle}>{t('act_likes_title')}</Text>
            {activity.likes.length === 0 ? (
              <Text style={styles.empty}>{t('act_no_posts')}</Text>
            ) : (
              activity.likes.map((l) => (
                <Pressable key={l.postId} style={styles.likeRow} onPress={() => goToPost(l.postId)}>
                  <Ionicons name="heart" size={16} color={theme.colors.danger} />
                  <Text style={styles.likeText} numberOfLines={1}>
                    {l.postText}
                  </Text>
                  <Text style={styles.likeCount}>{l.likeCount}</Text>
                </Pressable>
              ))
            )}

            <Text style={styles.sectionTitle}>{t('act_comments_on_posts_title')}</Text>
            {activity.comments.length === 0 ? (
              <Text style={styles.empty}>{t('act_no_comments')}</Text>
            ) : (
              activity.comments.map((c, i) => (
                <Pressable key={i} style={styles.commentRow} onPress={() => goToPost(c.postId)}>
                  <Text style={styles.commentAuthor}>
                    {c.authorEmoji} {c.authorName}
                  </Text>
                  <Text style={styles.commentText} numberOfLines={2}>
                    {c.text}
                  </Text>
                  <Text style={styles.commentMeta} numberOfLines={1}>
                    {t('act_comment_meta_prefix')} "{c.postText}"
                  </Text>
                </Pressable>
              ))
            )}

            <Text style={styles.sectionTitle}>{t('act_replies_title')}</Text>
            {activity.replies.length === 0 ? (
              <Text style={styles.empty}>{t('act_no_replies')}</Text>
            ) : (
              activity.replies.map((r, i) => (
                <Pressable key={i} style={styles.commentRow} onPress={() => goToPost(r.postId)}>
                  <Text style={styles.commentAuthor}>
                    {r.authorEmoji} {r.authorName}
                  </Text>
                  <Text style={styles.commentText} numberOfLines={2}>
                    {r.text}
                  </Text>
                  <Text style={styles.commentMeta} numberOfLines={1}>
                    {t('act_reply_meta_prefix')} "{r.myCommentText}"
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>

          <Pressable style={styles.communityBtn} onPress={goToCommunity}>
            <Ionicons name="people-outline" size={18} color={theme.colors.purple} />
            <Text style={styles.communityBtnText}>{t('act_go_community')}</Text>
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>{t('act_close')}</Text>
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
    maxHeight: '80%',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 12 },
  title: { fontFamily: theme.fonts.extraBold, fontSize: 18, color: theme.colors.text, marginBottom: 12 },
  scroll: { paddingBottom: 8 },
  sectionTitle: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.textMuted, marginBottom: 8, marginTop: 12 },
  empty: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textLight, marginBottom: 4 },
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: 12,
    marginBottom: 8,
  },
  likeText: { flex: 1, fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.text },
  likeCount: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.danger },
  commentRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: 12,
    marginBottom: 8,
    gap: 3,
  },
  commentAuthor: { fontFamily: theme.fonts.bold, fontSize: 13, color: theme.colors.text },
  commentText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.text, lineHeight: 18 },
  commentMeta: { fontFamily: theme.fonts.regular, fontSize: 11, color: theme.colors.textLight, marginTop: 2 },
  communityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.purpleLight,
    borderRadius: theme.radius.sm,
    paddingVertical: 13,
    marginTop: 8,
  },
  communityBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.purple },
  closeBtn: { alignItems: 'center', paddingVertical: 10 },
  closeBtnText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.textMuted },
});
