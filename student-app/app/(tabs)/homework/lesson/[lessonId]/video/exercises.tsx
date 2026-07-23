import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay';
import { CoinPill } from '@/components/ui/CoinIcon';
import { LightningPill } from '@/components/ui/LightningIcon';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { getResolvedLessonContent, GrammarBlank, LessonContent } from '@/data/lessonContent';
import { reportActivity } from '@/services/activitySync';
import { addCoins } from '@/services/coinsStore';
import { addLightning } from '@/services/lightningStore';
import { markDone } from '@/services/lessonProgressStore';

export default function VideoExercisesScreen() {
  const { t } = useLang();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const [content, setContent] = useState<LessonContent | null>(null);

  useEffect(() => {
    getResolvedLessonContent(String(lessonId), 0).then(setContent);
  }, [lessonId]);

  // Noto'g'ri javob berilgan savol darhol tashlab yuborilmaydi — navbat oxiriga
  // qo'shilib, to'g'ri javob berilgunicha qayta-qayta so'raladi. Shu sababli
  // "blanks" o'rniga o'zgaruvchan navbat (queue) saqlanadi; jami savollar soni
  // (total) esa hisoblash uchun boshlang'ich ro'yxatdan olinadi va o'zgarmaydi.
  const [queue, setQueue] = useState<GrammarBlank[] | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  useEffect(() => {
    if (content) setQueue(content.grammarBlanks);
  }, [content]);

  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [earnedLightning, setEarnedLightning] = useState(0);

  if (!content || !queue) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.resultCenter}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  const total = content.grammarBlanks.length;
  const completed = total - queue.length;
  const current = queue[0];
  const isCorrect = selected === current?.answer;

  const handleSelect = (opt: string) => {
    if (answered) return;
    setSelected(opt);
    setAnswered(true);
    if (opt === current.answer) {
      addCoins(1, String(lessonId));
      addLightning(1);
      setEarnedCoins((c) => c + 1);
      setEarnedLightning((l) => l + 1);
    } else {
      setWrongAttempts((w) => w + 1);
    }
  };

  const handleNext = () => {
    const rest = queue.slice(1);
    const nextQueue = isCorrect ? rest : [...rest, current];
    if (nextQueue.length === 0) {
      markDone(String(lessonId), 'videoExercises');
      // CRM'dagi (admin/ustoz uchun) faollik jurnali doim o'zbek tilida
      // ko'rsatiladi — bu yerdagi label ilova tiliga bog'liq emas.
      reportActivity({ type: 'video', label: `${lessonId} - Video mashqlar`, wrongAttempts });
      setFinished(true);
      return;
    }
    setQueue(nextQueue);
    setSelected(null);
    setAnswered(false);
  };

  if (finished) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <FinishedScreen
          total={total}
          wrongAttempts={wrongAttempts}
          earnedCoins={earnedCoins}
          earnedLightning={earnedLightning}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>{t('ve_title')}</Text>
        <Text style={styles.progress}>
          {completed} / {total}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(completed / total) * 100}%` }]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>{t('ve_instruction')}</Text>

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
          <Text style={styles.footerText}>{isCorrect ? t('ve_correct') : `${t('exam_correct_answer')} ${current.answer}`}</Text>
          <Pressable style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextText}>{t('common_keyingi')}</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function FinishedScreen({
  total,
  wrongAttempts,
  earnedCoins,
  earnedLightning,
}: {
  total: number;
  wrongAttempts: number;
  earnedCoins: number;
  earnedLightning: number;
}) {
  const { t } = useLang();
  const [celebrating, setCelebrating] = useState(true);
  return (
    <View style={styles.resultCenter}>
      <Text style={styles.resultEmoji}>🎉</Text>
      <Text style={styles.resultTitle}>{t('ex_finished_title')}</Text>
      <Text style={styles.resultSubtitle}>{t('ve_all_correct_sub').replace('{n}', String(total))}</Text>
      {wrongAttempts > 0 && <Text style={styles.resultSubtitle}>{t('ve_retry_count').replace('{n}', String(wrongAttempts))}</Text>}
      <View style={styles.rewardsRow}>
        <CoinPill amount={earnedCoins} />
        <LightningPill amount={earnedLightning} />
      </View>
      <Pressable style={styles.resultBtn} onPress={() => router.back()}>
        <Text style={styles.resultBtnText}>{t('ex_back_btn')}</Text>
      </Pressable>
      <CelebrationOverlay visible={celebrating} onFinish={() => setCelebrating(false)} />
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
  rewardsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  resultBtn: {
    marginTop: 16,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  resultBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },
});
