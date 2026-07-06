import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { BOOK_LEVEL_LABELS, BOOK_STORIES } from '@/data/bookStories';

export default function BookStoryScreen() {
  const { storyId } = useLocalSearchParams<{ storyId: string }>();
  const story = BOOK_STORIES.find((s) => s.id === storyId);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const isAutoRef = useRef(false);

  useEffect(() => {
    return () => {
      isAutoRef.current = false;
      Speech.stop();
    };
  }, []);

  if (!story) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Hikoya topilmadi</Text>
        </View>
      </SafeAreaView>
    );
  }

  const speakParagraph = (index: number, onDone?: () => void) => {
    const p = story.paragraphs[index];
    setPlayingIndex(index);
    Speech.speak(p.en, {
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
    isAutoRef.current = true;
    setAutoPlaying(true);
    const step = (i: number) => {
      if (!isAutoRef.current || i >= story.paragraphs.length) {
        isAutoRef.current = false;
        setAutoPlaying(false);
        setPlayingIndex(null);
        return;
      }
      speakParagraph(i, () => step(i + 1));
    };
    step(0);
  };

  const stopAll = () => {
    isAutoRef.current = false;
    setAutoPlaying(false);
    Speech.stop();
    setPlayingIndex(null);
  };

  const isBusy = autoPlaying || playingIndex !== null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <LinearGradient colors={story.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.heroEmoji}>{story.emoji}</Text>
        <Text style={styles.heroLevel}>{BOOK_LEVEL_LABELS[story.level]} · Audio-hikoya</Text>
        <Text style={styles.heroTitle}>{story.title}</Text>
        <Text style={styles.heroDesc}>{story.description}</Text>
      </LinearGradient>

      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {story.paragraphs.map((p, i) => {
          const active = playingIndex === i;
          return (
            <Pressable
              key={i}
              style={[styles.paraCard, active && styles.paraCardActive]}
              onPress={() => {
                isAutoRef.current = false;
                setAutoPlaying(false);
                speakParagraph(i);
              }}>
              <View style={styles.paraRow}>
                <View style={[styles.paraBadge, { backgroundColor: story.colors[0] }]}>
                  <Text style={styles.paraBadgeText}>{i + 1}</Text>
                </View>
                <View style={styles.paraTextWrap}>
                  <Text style={styles.paraEn}>{p.en}</Text>
                  <Text style={styles.paraUz}>{p.uz}</Text>
                </View>
                <Ionicons
                  name={active ? 'volume-high' : 'volume-medium-outline'}
                  size={16}
                  color={active ? theme.colors.purple : theme.colors.textLight}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.playBar}>
        <Pressable style={styles.playBtn} onPress={() => (isBusy ? stopAll() : playAll())}>
          <Ionicons name={isBusy ? 'pause' : 'play'} size={20} color="#fff" />
          <Text style={styles.playBtnText}>{isBusy ? "To'xtatish" : 'Hikoyani tinglash'}</Text>
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
  heroLevel: {
    fontFamily: theme.fonts.bold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroTitle: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: '#fff', marginBottom: 6 },
  heroDesc: { fontFamily: theme.fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 19 },

  scrollFlex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 24 },

  paraCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...theme.shadow.card,
  },
  paraCardActive: { borderColor: theme.colors.purple },
  paraRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  paraBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  paraBadgeText: { fontFamily: theme.fonts.bold, fontSize: 11, color: '#fff' },
  paraTextWrap: { flex: 1 },
  paraEn: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text, lineHeight: 21 },
  paraUz: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },

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
