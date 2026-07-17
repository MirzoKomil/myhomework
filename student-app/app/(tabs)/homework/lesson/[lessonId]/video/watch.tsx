import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentsSheet } from '@/components/CommentsSheet';
import { YouTubeEmbed } from '@/components/ui/YouTubeEmbed';
import { theme } from '@/constants/theme';
import { getResolvedLessonContent, LessonContent } from '@/data/lessonContent';
import { fetchMobileContent, getLessonMaterials, LessonMaterials } from '@/services/contentApi';
import { markDone } from '@/services/lessonProgressStore';
import { saveLastPosition } from '@/services/progressStore';

export default function WatchVideoScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const isBonus = String(lessonId).startsWith('bonus-');
  const [content, setContent] = useState<LessonContent | null>(null);
  const [materials, setMaterials] = useState<LessonMaterials | null>(null);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    getResolvedLessonContent(String(lessonId), 0).then(setContent);
    fetchMobileContent().then((mc) => setMaterials(getLessonMaterials(mc, String(lessonId))));
  }, [lessonId]);

  useEffect(() => {
    markDone(String(lessonId), 'videoWatch');
    saveLastPosition({ lessonId: String(lessonId), section: 'video/watch', label: 'Videodars' });
  }, [lessonId]);

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
          {materials?.videoUrl ? (
            <YouTubeEmbed url={materials.videoUrl} />
          ) : (
            <>
              <View style={[styles.playBtn, isBonus && styles.playBtnBonus]}>
                <Ionicons name="play" size={36} color="#fff" />
              </View>
              <Text style={styles.videoDuration}>Video hali biriktirilmagan</Text>
            </>
          )}
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.unitTitle}>{content.unitTitle}</Text>
          <Pressable style={styles.commentsPill} onPress={() => setShowComments(true)}>
            <Ionicons name="chatbubble-ellipses-outline" size={15} color={theme.colors.purple} />
            <Text style={styles.commentsPillText}>Izohlar</Text>
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

      <CommentsSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        category={isBonus ? 'bonus' : 'video'}
        itemId={String(lessonId)}
        itemLabel={content.unitTitle}
      />
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
});
