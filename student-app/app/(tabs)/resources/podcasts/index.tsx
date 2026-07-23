import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import {
  PodcastLevel,
  PODCAST_LEVEL_COLORS,
  PODCAST_LEVEL_LABELS,
  PODCAST_LEVELS_ORDER,
  PODCAST_EPISODES,
  PodcastEpisode,
} from '@/data/podcastEpisodes';
import { fetchMobileContent } from '@/services/contentApi';

export default function PodcastsLevelScreen() {
  const { t } = useLang();
  const [level, setLevel] = useState<PodcastLevel>('a1');
  const [allEpisodes, setAllEpisodes] = useState<(PodcastEpisode & { coverUrl?: string; audioUrl?: string })[]>(PODCAST_EPISODES);

  useEffect(() => {
    fetchMobileContent()
      .then((mc) => { if (mc.library.podcasts.length) setAllEpisodes(mc.library.podcasts); })
      .catch(() => {});
  }, []);

  const episodes = allEpisodes.filter((e) => e.level === level);
  const accent = PODCAST_LEVEL_COLORS[level];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('res_podcasts_title')} showBack />
      <View style={styles.tabs}>
        {PODCAST_LEVELS_ORDER.map((lv) => {
          const active = lv === level;
          return (
            <Pressable
              key={lv}
              style={[styles.tab, active && { backgroundColor: PODCAST_LEVEL_COLORS[lv] }]}
              onPress={() => setLevel(lv)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{PODCAST_LEVEL_LABELS[lv]}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{t('res_episode_count').replace('{n}', String(episodes.length))}</Text>
        <View style={styles.grid}>
          {episodes.map((ep) => (
            <Pressable
              key={ep.id}
              style={styles.cardWrap}
              onPress={() => router.push(`/resources/podcasts/${ep.id}` as never)}>
              {ep.coverUrl ? (
                <ImageBackground source={{ uri: ep.coverUrl }} style={styles.card} imageStyle={styles.cardImg}>
                  <View style={[styles.levelBadge, { backgroundColor: accent }]}>
                    <Text style={styles.levelBadgeText}>{PODCAST_LEVEL_LABELS[level]}</Text>
                  </View>
                </ImageBackground>
              ) : (
                <LinearGradient colors={ep.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
                  <View style={[styles.levelBadge, { backgroundColor: accent }]}>
                    <Text style={styles.levelBadgeText}>{PODCAST_LEVEL_LABELS[level]}</Text>
                  </View>
                  <Text style={styles.cardEmoji}>{ep.emoji}</Text>
                </LinearGradient>
              )}
              <Text style={styles.cardTitle} numberOfLines={2}>
                {ep.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 4,
    ...theme.shadow.card,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.sm, alignItems: 'center' },
  tabText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.textMuted },
  tabTextActive: { color: '#fff' },
  scroll: { padding: 20, paddingBottom: 40 },
  subtitle: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  cardWrap: { width: '31%' },
  card: {
    borderRadius: theme.radius.md,
    aspectRatio: 0.95,
    padding: 10,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  levelBadge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  levelBadgeText: { fontFamily: theme.fonts.bold, fontSize: 9, color: '#fff' },
  cardEmoji: { fontSize: 32 },
  cardTitle: { fontFamily: theme.fonts.semiBold, fontSize: 11, color: theme.colors.text, textAlign: 'center', marginTop: 6, lineHeight: 14 },
  cardImg: { borderRadius: theme.radius.md },
});
