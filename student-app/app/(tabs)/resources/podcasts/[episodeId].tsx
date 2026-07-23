import { Ionicons } from '@expo/vector-icons';
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { getHomeworkArtworkUri, HOMEWORK_SCHOOL_NAME } from '@/constants/nowPlaying';
import { PODCAST_EPISODES, PODCAST_LEVEL_LABELS, PodcastEpisode } from '@/data/podcastEpisodes';
import { fetchMobileContent } from '@/services/contentApi';

export default function PodcastEpisodeScreen() {
  const { t } = useLang();
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const [allEpisodes, setAllEpisodes] = useState<(PodcastEpisode & { coverUrl?: string; audioUrl?: string })[]>(PODCAST_EPISODES);
  const episode = allEpisodes.find((e) => e.id === episodeId);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const isAutoRef = useRef(false);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    fetchMobileContent()
      .then((mc) => { if (mc.library.podcasts.length) setAllEpisodes(mc.library.podcasts); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      isAutoRef.current = false;
      Speech.stop();
      audioPlayerRef.current?.clearLockScreenControls();
      audioPlayerRef.current?.remove();
      audioPlayerRef.current = null;
    };
  }, []);

  if (!episode) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('res_episode_not_found')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const speakLine = (index: number, onDone?: () => void) => {
    const line = episode.lines[index];
    setPlayingIndex(index);
    Speech.speak(line.en, {
      language: 'en-US',
      rate: 0.95,
      onDone: () => {
        setPlayingIndex((cur) => (cur === index ? null : cur));
        onDone?.();
      },
      onStopped: () => {
        setPlayingIndex((cur) => (cur === index ? null : cur));
      },
    });
  };

  const playAll = () => {
    if (episode.audioUrl) {
      setAutoPlaying(true);
      const player = createAudioPlayer(episode.audioUrl);
      audioPlayerRef.current = player;
      player.addListener('playbackStatusUpdate', (status) => {
        if (audioPlayerRef.current !== player) return;
        if (status.didJustFinish) {
          setAutoPlaying(false);
          player.clearLockScreenControls();
          player.remove();
          audioPlayerRef.current = null;
        }
      });
      // 146-ish: qulflangan ekran/boshqaruv markazida epizod nomi va
      // Homework logotipi ko'rinishi uchun.
      player.setActiveForLockScreen(true, {
        title: episode.title,
        artist: HOMEWORK_SCHOOL_NAME,
        artworkUrl: getHomeworkArtworkUri(),
      });
      player.play();
      return;
    }
    isAutoRef.current = true;
    setAutoPlaying(true);
    const step = (i: number) => {
      if (!isAutoRef.current || i >= episode.lines.length) {
        isAutoRef.current = false;
        setAutoPlaying(false);
        setPlayingIndex(null);
        return;
      }
      speakLine(i, () => step(i + 1));
    };
    step(0);
  };

  const stopAll = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.clearLockScreenControls();
      audioPlayerRef.current.remove();
      audioPlayerRef.current = null;
      setAutoPlaying(false);
      return;
    }
    isAutoRef.current = false;
    setAutoPlaying(false);
    Speech.stop();
    setPlayingIndex(null);
  };

  const isBusy = autoPlaying || playingIndex !== null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={episode.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        {episode.coverUrl ? (
          <Image source={{ uri: episode.coverUrl }} style={styles.heroCoverImg} resizeMode="cover" />
        ) : (
          <Text style={styles.heroEmoji}>{episode.emoji}</Text>
        )}
        <Text style={styles.heroLevel}>{PODCAST_LEVEL_LABELS[episode.level]} · {t('res_podcast_label')}</Text>
        <Text style={styles.heroTitle}>{episode.title}</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>{t('res_text_label')}</Text>
        {episode.lines.map((line, i) => {
          const active = playingIndex === i;
          return (
            <Pressable
              key={i}
              style={[styles.lineCard, active && styles.lineCardActive]}
              onPress={() => {
                isAutoRef.current = false;
                setAutoPlaying(false);
                speakLine(i);
              }}>
              <View style={styles.lineRow}>
                <Text style={styles.lineEn}>{line.en}</Text>
                <Ionicons
                  name={active ? 'volume-high' : 'volume-medium-outline'}
                  size={16}
                  color={active ? theme.colors.purple : theme.colors.textLight}
                />
              </View>
              <Text style={styles.lineUz}>{line.uz}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.playBar}>
        <Pressable style={styles.playBtn} onPress={() => (isBusy ? stopAll() : playAll())}>
          <Ionicons name={isBusy ? 'pause' : 'play'} size={20} color="#fff" />
          <Text style={styles.playBtnText}>{isBusy ? t('common_toxtatish') : t('res_listen_all')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },

  hero: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroEmoji: { fontSize: 44, marginBottom: 8 },
  heroCoverImg: { width: 72, height: 72, borderRadius: 16, marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroLevel: {
    fontFamily: theme.fonts.bold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroTitle: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: '#fff' },

  scrollFlex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 24 },
  sectionLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  lineCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...theme.shadow.card,
  },
  lineCardActive: { borderColor: theme.colors.purple },
  lineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  lineEn: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text, lineHeight: 21 },
  lineUz: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },

  playBar: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4 },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.md,
    paddingVertical: 15,
    ...theme.shadow.card,
  },
  playBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
