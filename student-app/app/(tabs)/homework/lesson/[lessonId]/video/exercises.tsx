import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { getResolvedLessonContent, LessonContent } from '@/data/lessonContent';
import { addCoins } from '@/services/coinsStore';
import { addLightning } from '@/services/lightningStore';
import { markDone } from '@/services/lessonProgressStore';

export default function VideoExercisesScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [content, setContent] = useState<LessonContent | null>(null);

  useEffect(() => {
    getResolvedLessonContent(String(lessonId), 0).then(setContent);
  }, [lessonId]);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
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

  const blanks = content.grammarBlanks;
  const current = blanks[index];
  const isCorrect = selected === current?.answer;

  const handleSelect = (opt: string) => {
    if (answered) return;
    setSelected(opt);
    setAnswered(true);
    if (opt === current.answer) {
      setCorrectCount((c) => c + 1);
      addCoins(1, String(lessonId));
      addLightning(1);
    }
  };

  const handleNext = () => {
    if (index + 1 >= blanks.length) {
      markDone(String(lessonId), 'videoExercises');
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setSelected(null);
    setAnswered(false);
  };

  if (finished) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.resultCenter}>
          <Text style={styles.resultEmoji}>🎉</Text>
          <Text style={styles.resultTitle}>Mashqlar tugadi!</Text>
          <Text style={styles.resultSubtitle}>
            {correctCount} / {blanks.length} to'g'ri javob
          </Text>
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
        <Text style={styles.topTitle}>Grammar mashqlar</Text>
        <Text style={styles.progress}>
          {index + 1} / {blanks.length}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((index + 1) / blanks.length) * 100}%` }]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>Bo'sh joyga mos so'zni tanlang</Text>

        <View style={styles.sentenceCard}>
          <Ionicons name="volume-high" size={18} color={theme.colors.purple} style={{ marginBottom: 10 }} />
          <Text style={styles.sentence}>{current.sentence}</Text>
        </View>

        <View style={styles.grid}>
          {current.options.map((opt) => {
            const isSelected = selected === opt;
            const showResult = answered && isSelected;
            const showCorrectHint = answered && opt === current.answer && !isSelected;
            return (
              <Pressable
                key={opt}
                style={[
                  styles.option,
                  isSelected && styles.optionSelected,
                  showResult && (isCorrect ? styles.optionCorrect : styles.optionWrong),
                  showCorrectHint && styles.optionCorrect,
                ]}
                onPress={() => handleSelect(opt)}>
                <Text style={styles.optionText}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {answered && (
        <View style={[styles.footer, isCorrect ? styles.footerCorrect : styles.footerWrong]}>
          <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={22} color="#fff" />
          <Text style={styles.footerText}>{isCorrect ? "To'g'ri javob!" : `To'g'ri javob: ${current.answer}`}</Text>
          <Pressable style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextText}>Keyingi</Text>
          </Pressable>
        </View>
      )}
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
  sentenceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    ...theme.shadow.card,
  },
  sentence: { fontFamily: theme.fonts.semiBold, fontSize: 18, color: theme.colors.text, textAlign: 'center', lineHeight: 26 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  option: {
    minWidth: '47%',
    flexGrow: 1,
    paddingVertical: 18,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadow.card,
  },
  optionSelected: { borderColor: theme.colors.purple },
  optionCorrect: { borderColor: theme.colors.success, backgroundColor: theme.colors.successBg },
  optionWrong: { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerBg },
  optionText: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  footer: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 },
  footerCorrect: { backgroundColor: theme.colors.success },
  footerWrong: { backgroundColor: theme.colors.danger },
  footerText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: 14, color: '#fff' },
  nextBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  nextText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },

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
