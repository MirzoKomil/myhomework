import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { theme } from '@/constants/theme';
import { PRONUNCIATION_TOPICS } from '@/data/pronunciationTopics';

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PronunciationTopicScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const topic = PRONUNCIATION_TOPICS.find((t) => t.id === topicId);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [speakingWord, setSpeakingWord] = useState<number | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const wordCount = topic ? topic.synopsis.split(/\s+/).length : 0;
  const estimatedDuration = Math.max(3000, wordCount * 380);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => setElapsedMs(value * estimatedDuration));
    return () => progressAnim.removeListener(id);
  }, [estimatedDuration]);

  if (!topic) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader title="Mavzu" showBack />
        <View style={styles.center}>
          <Text style={styles.emptyText}>Mavzu topilmadi</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stopSynopsis = () => {
    Speech.stop();
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    setIsPlaying(false);
    setElapsedMs(0);
  };

  const playSynopsis = () => {
    setIsPlaying(true);
    progressAnim.setValue(0);
    Animated.timing(progressAnim, { toValue: 1, duration: estimatedDuration, useNativeDriver: false }).start(({ finished }) => {
      if (finished) {
        setIsPlaying(false);
        progressAnim.setValue(0);
        setElapsedMs(0);
      }
    });
    Speech.speak(topic.synopsis, {
      language: 'uz',
      rate: 0.95,
      onDone: () => {
        progressAnim.stopAnimation();
        progressAnim.setValue(0);
        setIsPlaying(false);
        setElapsedMs(0);
      },
      onStopped: () => {
        progressAnim.stopAnimation();
      },
      onError: () => {
        progressAnim.stopAnimation();
        progressAnim.setValue(0);
        setIsPlaying(false);
        setElapsedMs(0);
      },
    });
  };

  const speakExample = (index: number, text: string) => {
    setSpeakingWord(index);
    Speech.speak(text, {
      language: 'en-US',
      rate: 0.9,
      onDone: () => setSpeakingWord((cur) => (cur === index ? null : cur)),
      onStopped: () => setSpeakingWord((cur) => (cur === index ? null : cur)),
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={topic.title} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.audioBar}>
          <Pressable
            style={[styles.playCircle, { backgroundColor: topic.color }]}
            onPress={() => (isPlaying ? stopSynopsis() : playSynopsis())}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
          </Pressable>
          <View style={styles.audioInfo}>
            <Text style={styles.audioTitle} numberOfLines={1}>
              {topic.title} — audio tushuntirish
            </Text>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { backgroundColor: topic.color, width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                ]}
              />
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(elapsedMs)}</Text>
              <Text style={styles.timeText}>{formatTime(estimatedDuration)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Konspekt</Text>
        <Text style={styles.synopsis}>{topic.synopsis}</Text>

        <Text style={styles.sectionLabel}>Misollar</Text>
        {topic.examples.map((example, i) => {
          const active = speakingWord === i;
          return (
            <Pressable
              key={i}
              style={[styles.exampleCard, active && { borderColor: topic.color }]}
              onPress={() => speakExample(i, example.text)}>
              <View style={styles.exampleInfo}>
                <Text style={styles.exampleText}>{example.text}</Text>
                <Text style={styles.exampleHint}>{example.hint}</Text>
              </View>
              <Ionicons
                name={active ? 'volume-high' : 'volume-medium-outline'}
                size={18}
                color={active ? topic.color : theme.colors.textLight}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },
  scroll: { padding: 20, paddingBottom: 40 },

  audioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 24,
    ...theme.shadow.card,
  },
  playCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  audioInfo: { flex: 1 },
  audioTitle: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text, marginBottom: 8 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: theme.colors.border, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  timeText: { fontFamily: theme.fonts.regular, fontSize: 10, color: theme.colors.textLight },

  sectionLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: theme.colors.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  synopsis: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.text, lineHeight: 23, marginBottom: 24 },

  exampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 14,
    marginBottom: 10,
    ...theme.shadow.card,
  },
  exampleInfo: { flex: 1, paddingRight: 10 },
  exampleText: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text },
  exampleHint: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});
