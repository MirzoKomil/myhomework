import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { getResolvedLessonContent, LessonContent, VOCAB_PRACTICE_SIZE, VocabWord } from '@/data/lessonContent';
import { addCoins } from '@/services/coinsStore';
import { addLightning } from '@/services/lightningStore';
import { markDone } from '@/services/lessonProgressStore';
import { saveLastPosition } from '@/services/progressStore';

const PRACTICE_SIZE = VOCAB_PRACTICE_SIZE;
const STEP_LABELS = ['Choose translation', 'Construct word', 'Pronounce word'];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDistractors(all: VocabWord[], correct: VocabWord, count: number): string[] {
  const others = all.filter((w) => w.id !== correct.id).map((w) => w.translation);
  return shuffle(others).slice(0, count);
}

export default function VocabularyPracticeScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [content, setContent] = useState<LessonContent | null>(null);

  useEffect(() => {
    getResolvedLessonContent(String(lessonId), 0).then(setContent);
  }, [lessonId]);

  const words = useMemo(() => (content ? content.vocabulary.slice(0, PRACTICE_SIZE) : []), [content]);

  const [round, setRound] = useState(0); // 0: translation, 1: construct, 2: pronounce
  const [wordIndex, setWordIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = words[wordIndex];
  const totalSteps = words.length * STEP_LABELS.length;
  const stepNumber = round * words.length + wordIndex;

  if (!content) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.resultCenter}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  const advance = (correct: boolean) => {
    if (correct) {
      addCoins(1, String(lessonId));
      addLightning(1);
    }
    if (wordIndex + 1 < words.length) {
      setWordIndex(wordIndex + 1);
      return;
    }
    if (round + 1 < STEP_LABELS.length) {
      setRound(round + 1);
      setWordIndex(0);
      return;
    }
    markDone(String(lessonId), 'vocabPractice');
    saveLastPosition({ lessonId: String(lessonId), section: 'vocabulary/practice', label: "O'rganish, yodlash, takrorlash" });
    setFinished(true);
  };

  if (finished) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.resultCenter}>
          <Text style={styles.resultEmoji}>📚</Text>
          <Text style={styles.resultTitle}>Ajoyib!</Text>
          <Text style={styles.resultSubtitle}>{words.length} ta so'z bo'yicha 3 bosqichli mashq yakunlandi</Text>
          <Pressable style={styles.resultBtn} onPress={() => router.back()}>
            <Text style={styles.resultBtnText}>Orqaga qaytish</Text>
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
        <Text style={styles.topTitle}>{STEP_LABELS[round]}</Text>
        <Text style={styles.progress}>
          {stepNumber + 1} / {totalSteps}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((stepNumber + 1) / totalSteps) * 100}%` }]} />
      </View>

      {round === 0 && <ChooseTranslationStep key={current.id} word={current} allWords={words} onDone={advance} />}
      {round === 1 && <ConstructWordStep key={current.id} word={current} onDone={advance} />}
      {round === 2 && <PronounceWordStep key={current.id} word={current} onDone={advance} />}
    </SafeAreaView>
  );
}

function ChooseTranslationStep({ word, allWords, onDone }: { word: VocabWord; allWords: VocabWord[]; onDone: (correct: boolean) => void }) {
  const options = useMemo(
    () => shuffle([word.translation, ...pickDistractors(allWords, word, 3)]),
    [word, allWords]
  );
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;
  const isCorrect = selected === word.translation;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.instruction}>Tarjimasini tanlang</Text>
      <Pressable style={styles.wordCard} onPress={() => Speech.speak(word.english, { language: 'en-US', rate: 0.9 })}>
        <Ionicons name={word.icon} size={44} color={theme.colors.purple} />
        <View style={styles.wordEnglishRow}>
          <Text style={styles.wordEnglish}>{word.english}</Text>
          <Ionicons name="volume-medium-outline" size={18} color={theme.colors.textLight} />
        </View>
        <Text style={styles.wordTranscript}>{word.transcript}</Text>
      </Pressable>
      <View style={styles.optionsGrid}>
        {options.map((opt) => {
          const isSelected = selected === opt;
          const showResult = answered && isSelected;
          return (
            <Pressable
              key={opt}
              style={[
                styles.optionTile,
                showResult && (isCorrect ? styles.optionCorrect : styles.optionWrong),
                answered && opt === word.translation && !isSelected && styles.optionCorrect,
              ]}
              disabled={answered}
              onPress={() => setSelected(opt)}>
              <Text style={styles.optionTileText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {answered && (
        <Pressable style={styles.continueBtn} onPress={() => onDone(isCorrect)}>
          <Text style={styles.continueBtnText}>Davom etish</Text>
        </Pressable>
      )}
    </View>
  );
}

function ConstructWordStep({ word, onDone }: { word: VocabWord; onDone: (correct: boolean) => void }) {
  const letters = useMemo(() => shuffle(word.english.split('')), [word]);
  const [used, setUsed] = useState<boolean[]>(() => letters.map(() => false));
  const [built, setBuilt] = useState<number[]>([]);

  const tapLetter = (idx: number) => {
    if (used[idx]) return;
    setUsed((u) => u.map((v, i) => (i === idx ? true : v)));
    setBuilt((b) => [...b, idx]);
  };

  const reset = () => {
    setUsed(letters.map(() => false));
    setBuilt([]);
  };

  const builtWord = built.map((i) => letters[i]).join('');
  const isComplete = built.length === letters.length;
  const isCorrect = builtWord === word.english;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.instruction}>Harflardan so'zni yig'ing</Text>
      <View style={styles.wordCard}>
        <Ionicons name={word.icon} size={44} color={theme.colors.purple} />
        <Text style={styles.wordTranslationBig}>{word.translation}</Text>
      </View>

      <View style={styles.builtRow}>
        {letters.map((_, i) => (
          <View key={i} style={styles.builtSlot}>
            <Text style={styles.builtSlotText}>{built[i] !== undefined ? letters[built[i]] : ''}</Text>
          </View>
        ))}
      </View>

      <View style={styles.lettersGrid}>
        {letters.map((ch, i) => (
          <Pressable key={i} style={[styles.letterTile, used[i] && styles.letterTileUsed]} disabled={used[i]} onPress={() => tapLetter(i)}>
            <Text style={styles.letterTileText}>{ch}</Text>
          </Pressable>
        ))}
      </View>

      {isComplete ? (
        <View style={{ gap: 10 }}>
          <Text style={[styles.feedbackText, { color: isCorrect ? theme.colors.success : theme.colors.danger }]}>
            {isCorrect ? "To'g'ri!" : `To'g'ri javob: ${word.english}`}
          </Text>
          <Pressable style={styles.continueBtn} onPress={() => onDone(isCorrect)}>
            <Text style={styles.continueBtnText}>Davom etish</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.resetBtn} onPress={reset}>
          <Ionicons name="refresh" size={16} color={theme.colors.textMuted} />
          <Text style={styles.resetBtnText}>Tozalash</Text>
        </Pressable>
      )}
    </View>
  );
}

function PronounceWordStep({ word, onDone }: { word: VocabWord; onDone: (correct: boolean) => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);

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
  };

  return (
    <View style={styles.stepContent}>
      <Text style={styles.instruction}>So'zni talaffuz qiling</Text>
      <Pressable style={styles.wordCard} onPress={() => Speech.speak(word.english, { language: 'en-US', rate: 0.9 })}>
        <Ionicons name={word.icon} size={44} color={theme.colors.purple} />
        <View style={styles.wordEnglishRow}>
          <Text style={styles.wordEnglish}>{word.english}</Text>
          <Ionicons name="volume-medium-outline" size={18} color={theme.colors.textLight} />
        </View>
        <Text style={styles.wordTranscript}>{word.transcript}</Text>
      </Pressable>
      <View style={styles.pronounceArea}>
        <Pressable style={[styles.micBtn, isRecording && styles.micBtnActive]} onPress={toggleRecording}>
          <Ionicons name={isRecording ? 'stop' : 'mic'} size={30} color="#fff" />
        </Pressable>
        {recorded && (
          <View style={styles.recordedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
            <Text style={styles.recordedText}>Ovoz yozib olindi</Text>
          </View>
        )}
      </View>
      {recorded && (
        <Pressable style={styles.continueBtn} onPress={() => onDone(true)}>
          <Text style={styles.continueBtnText}>Davom etish</Text>
        </Pressable>
      )}
    </View>
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
  topTitle: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  progress: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted },
  progressBar: { height: 4, backgroundColor: theme.colors.border, marginHorizontal: 20 },
  progressFill: { height: 4, backgroundColor: theme.colors.purple, borderRadius: 2 },
  stepContent: { flex: 1, padding: 20 },
  instruction: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 16 },
  wordCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    gap: 4,
    ...theme.shadow.card,
  },
  wordEnglishRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  wordEnglish: { fontFamily: theme.fonts.extraBold, fontSize: 24, color: theme.colors.text },
  wordTranscript: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted },
  wordTranslationBig: { fontFamily: theme.fonts.bold, fontSize: 20, color: theme.colors.text, marginTop: 8 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionTile: {
    minWidth: '47%',
    flexGrow: 1,
    paddingVertical: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadow.card,
  },
  optionCorrect: { borderColor: theme.colors.success, backgroundColor: theme.colors.successBg },
  optionWrong: { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerBg },
  optionTileText: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  builtRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 20 },
  builtSlot: {
    width: 34,
    height: 40,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builtSlotText: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.text, textTransform: 'uppercase' },
  lettersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 20 },
  letterTile: {
    width: 40,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  letterTileUsed: { opacity: 0.25 },
  letterTileText: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text, textTransform: 'uppercase' },
  feedbackText: { fontFamily: theme.fonts.semiBold, fontSize: 15, textAlign: 'center' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  resetBtnText: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted },
  pronounceArea: { alignItems: 'center', marginTop: 12, gap: 12 },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: theme.colors.danger },
  recordedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recordedText: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.success },
  continueBtn: {
    marginTop: 16,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },

  resultCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8 },
  resultEmoji: { fontSize: 56 },
  resultTitle: { fontFamily: theme.fonts.extraBold, fontSize: 22, color: theme.colors.text },
  resultSubtitle: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted, textAlign: 'center' },
  resultBtn: {
    marginTop: 16,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  resultBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
