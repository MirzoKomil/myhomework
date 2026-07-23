import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { getResolvedLessonContent, LessonContent } from '@/data/lessonContent';
import { markDone } from '@/services/lessonProgressStore';

export default function SpeakingExercisesScreen() {
  const { t } = useLang();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [content, setContent] = useState<LessonContent | null>(null);

  useEffect(() => {
    getResolvedLessonContent(String(lessonId), 1).then(setContent);
  }, [lessonId]);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [index, setIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [finished, setFinished] = useState(false);

  if (!content) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.resultCenter}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  const prompts = content.speakingPractice;
  const current = prompts[index];

  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      await recorder.stop();
      setRecorded(true);
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
    setRecorded(false);
  };

  const handleNext = () => {
    if (index + 1 >= prompts.length) {
      markDone(String(lessonId), 'speakingExercises');
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setRecorded(false);
  };

  if (finished) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.resultCenter}>
          <Text style={styles.resultEmoji}>🎤</Text>
          <Text style={styles.resultTitle}>{t('ex_finished_title')}</Text>
          <Text style={styles.resultSubtitle}>{t('se_sentences_practiced').replace('{n}', String(prompts.length))}</Text>
          <Pressable style={styles.resultBtn} onPress={() => router.back()}>
            <Text style={styles.resultBtnText}>{t('ex_back_btn')}</Text>
          </Pressable>
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
        <Text style={styles.topTitle}>{t('se_title')}</Text>
        <Text style={styles.progress}>
          {index + 1} / {prompts.length}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((index + 1) / prompts.length) * 100}%` }]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>{t('se_instruction')}</Text>

        <View style={styles.wordCard}>
          <View style={styles.illustration}>
            <Ionicons name="chatbubble-ellipses-outline" size={56} color={theme.colors.purple} />
          </View>
          <Text style={styles.sentence}>{current.sentence}</Text>
          <Text style={styles.translation}>{current.translation}</Text>
          <Pressable style={styles.speakerBtn}>
            <Ionicons name="volume-high" size={22} color={theme.colors.purple} />
          </Pressable>
        </View>

        <View style={styles.recordArea}>
          <View style={styles.waveform}>
            {[...Array(20)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  { height: 8 + (i % 5) * 6, backgroundColor: isRecording ? theme.colors.danger : theme.colors.purpleLight },
                ]}
              />
            ))}
          </View>
          <Pressable style={[styles.micBtn, isRecording && styles.micBtnActive]} onPress={toggleRecording}>
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={32} color="#fff" />
          </Pressable>
          {recorded && (
            <View style={styles.recordedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
              <Text style={styles.recordedText}>{t('se_recorded')}</Text>
            </View>
          )}
        </View>
      </View>

      <Pressable style={[styles.nextBtn, !recorded && styles.nextBtnDisabled]} disabled={!recorded} onPress={handleNext}>
        <Text style={styles.nextBtnText}>{t('common_keyingi')}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text },
  progress: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.textMuted },
  progressBar: { height: 4, backgroundColor: theme.colors.border, marginHorizontal: 20 },
  progressFill: { height: 4, backgroundColor: theme.colors.purple, borderRadius: 2 },
  content: { flex: 1, padding: 20 },
  instruction: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 16 },
  wordCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  illustration: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sentence: { fontFamily: theme.fonts.bold, fontSize: 18, color: theme.colors.text, textAlign: 'center' },
  translation: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginTop: 6, textAlign: 'center' },
  speakerBtn: {
    marginTop: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordArea: {
    marginTop: 24,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 40, marginBottom: 20 },
  waveBar: { width: 4, borderRadius: 2 },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: theme.colors.danger },
  recordedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  recordedText: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.success },
  nextBtn: {
    margin: 20,
    marginTop: 0,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontFamily: theme.fonts.bold, fontSize: 16, color: '#fff' },

  resultCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 },
  resultEmoji: { fontSize: 56 },
  resultTitle: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: theme.colors.text },
  resultSubtitle: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },
  resultBtn: {
    marginTop: 16,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  resultBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
