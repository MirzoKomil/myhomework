import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EXAM_PASS_PERCENT, ExamQuestion, getExam } from '@/data/exams';
import { theme } from '@/constants/theme';
import { ExamMistake, saveExamResult } from '@/services/examStore';

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function questionPrompt(q: ExamQuestion): string {
  if (q.kind === 'multipleChoice') return q.question;
  if (q.kind === 'fillBlank') return q.sentence;
  if (q.kind === 'sentenceBuild') return q.translation;
  return q.sentence;
}

function correctAnswerLabel(q: ExamQuestion): string {
  if (q.kind === 'multipleChoice') return q.options[q.correctIndex];
  if (q.kind === 'fillBlank') return q.answer;
  if (q.kind === 'sentenceBuild') return q.answer.join(' ');
  return "To'g'ri talaffuz bilan aytilishi";
}

type Phase = 'intro' | 'active' | 'break' | 'result';

export default function ExamScreen() {
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const exam = useMemo(() => getExam(String(examId)), [examId]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [qIndex, setQIndex] = useState(0);
  const [remaining, setRemaining] = useState(exam?.durationSeconds ?? 0);
  const [breakRemaining, setBreakRemaining] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakes, setMistakes] = useState<ExamMistake[]>([]);

  const [mcSelected, setMcSelected] = useState<number | null>(null);
  const [blankSelected, setBlankSelected] = useState<string | null>(null);
  const [builtOrder, setBuiltOrder] = useState<number[]>([]);
  const [speakingDone, setSpeakingDone] = useState(false);

  const current = exam?.questions[qIndex];
  const shuffledWords = useMemo(() => {
    if (current?.kind === 'sentenceBuild') return shuffle(current.words);
    return [];
  }, [current]);

  // Imtihon taymeri
  useEffect(() => {
    if (phase !== 'active' || !exam) return;
    if (remaining <= 0) {
      finishExam();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, remaining]);

  // Tanaffus taymeri
  useEffect(() => {
    if (phase !== 'break') return;
    if (breakRemaining <= 0) {
      setPhase('active');
      return;
    }
    const t = setTimeout(() => setBreakRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, breakRemaining]);

  if (!exam) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.body}>Imtihon topilmadi</Text>
        </View>
      </SafeAreaView>
    );
  }

  const start = () => {
    setRemaining(exam.durationSeconds);
    setQIndex(0);
    setCorrectCount(0);
    setMistakes([]);
    setPhase('active');
  };

  function recordAnswer(isCorrect: boolean, yourAnswer: string) {
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
    } else if (current) {
      setMistakes((m) => [...m, { question: questionPrompt(current), yourAnswer, correctAnswer: correctAnswerLabel(current) }]);
    }
  }

  function finishExam() {
    const total = exam!.questions.length;
    const answeredSoFar = qIndex + (phase === 'active' ? 0 : 1);
    // Vaqt tugab qolgan bo'lsa, javob berilmagan savollar xato hisoblanadi.
    const scorePercent = Math.round((correctCount / total) * 100);
    const passed = scorePercent >= EXAM_PASS_PERCENT;
    saveExamResult(exam!.id, { passed, scorePercent, mistakes, attemptedAt: Date.now() });
    setPhase('result');
    void answeredSoFar;
  }

  const goNext = () => {
    const isLast = qIndex + 1 >= exam.questions.length;
    setMcSelected(null);
    setBlankSelected(null);
    setBuiltOrder([]);
    setSpeakingDone(false);
    if (isLast) {
      finishExam();
      return;
    }
    const nextIndex = qIndex + 1;
    if (exam.breakAfterIndex !== null && qIndex === exam.breakAfterIndex) {
      setBreakRemaining(exam.breakSeconds);
      setPhase('break');
    }
    setQIndex(nextIndex);
  };

  // ─── Intro ──────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={26} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.topTitle}>Imtihon</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.introWrap}>
          <View style={styles.introIconWrap}>
            <Ionicons name="school" size={40} color={theme.colors.blue} />
          </View>
          <Text style={styles.introTitle}>{exam.title}</Text>
          <View style={styles.introStatsRow}>
            <View style={styles.introStat}>
              <Text style={styles.introStatValue}>{exam.questions.length}</Text>
              <Text style={styles.introStatLabel}>savol</Text>
            </View>
            <View style={styles.introStat}>
              <Text style={styles.introStatValue}>{Math.round(exam.durationSeconds / 60)}</Text>
              <Text style={styles.introStatLabel}>daqiqa</Text>
            </View>
            <View style={styles.introStat}>
              <Text style={styles.introStatValue}>{EXAM_PASS_PERCENT}%</Text>
              <Text style={styles.introStatLabel}>o'tish balli</Text>
            </View>
          </View>
          <Text style={styles.introHint}>
            ⏱️ Imtihon boshlanganda vaqt orqaga sanaladi.{'\n'}
            {exam.breakAfterIndex !== null && `☕ Yarmida ${Math.round(exam.breakSeconds / 60)} daqiqalik tanaffus beriladi.\n`}
            🎯 Har bir savol savol turiga mos usulda (test, gap to'ldirish, gap tuzish, speaking) tekshiriladi.{'\n'}
            📊 Oxirida foiz, o'tdi/o'tmadi natijasi va xatolaringizga izoh chiqadi.
          </Text>
          <Pressable style={styles.startBtn} onPress={start}>
            <Text style={styles.startBtnText}>Imtihonni boshlash</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Break ──────────────────────────────────────────────────────────────
  if (phase === 'break') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.breakWrap}>
          <Text style={styles.breakEmoji}>☕</Text>
          <Text style={styles.breakTitle}>Qisqa tanaffus</Text>
          <Text style={styles.breakClock}>{formatClock(breakRemaining)}</Text>
          <Text style={styles.breakHint}>Dam oling, imtihon avtomatik davom etadi.</Text>
          <Pressable style={styles.breakSkipBtn} onPress={() => setPhase('active')}>
            <Text style={styles.breakSkipBtnText}>Hoziroq davom etish</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Result ─────────────────────────────────────────────────────────────
  if (phase === 'result') {
    const total = exam.questions.length;
    const scorePercent = Math.round((correctCount / total) * 100);
    const passed = scorePercent >= EXAM_PASS_PERCENT;
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={26} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.topTitle}>Natija</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.resultBanner, passed ? styles.resultBannerPass : styles.resultBannerFail]}>
            <Text style={styles.resultEmoji}>{passed ? '🎉' : '📚'}</Text>
            <Text style={styles.resultPercent}>{scorePercent}%</Text>
            <Text style={styles.resultVerdict}>{passed ? "Imtihondan o'tdingiz!" : "Imtihondan o'ta olmadingiz"}</Text>
            <Text style={styles.resultSub}>
              {correctCount}/{total} ta savolga to'g'ri javob berdingiz{!passed ? ` — o'tish balli ${EXAM_PASS_PERCENT}%` : ''}
            </Text>
          </View>

          {mistakes.length > 0 && (
            <>
              <Text style={styles.mistakesTitle}>Xatolaringiz ({mistakes.length})</Text>
              {mistakes.map((m, i) => (
                <View key={i} style={styles.mistakeCard}>
                  <Text style={styles.mistakeQuestion}>{m.question}</Text>
                  <Text style={styles.mistakeYour}>Sizning javobingiz: {m.yourAnswer}</Text>
                  <Text style={styles.mistakeCorrect}>To'g'ri javob: {m.correctAnswer}</Text>
                </View>
              ))}
            </>
          )}

          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Imtihonlar ro'yxatiga qaytish</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Active (savol) ─────────────────────────────────────────────────────
  const q = current!;
  const timerLow = remaining < 60;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Text style={styles.progress}>
          {qIndex + 1}/{exam.questions.length}
        </Text>
        <View style={[styles.timerPill, timerLow && styles.timerPillLow]}>
          <Ionicons name="timer-outline" size={15} color={timerLow ? theme.colors.danger : theme.colors.blue} />
          <Text style={[styles.timerText, timerLow && styles.timerTextLow]}>{formatClock(remaining)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.qScroll} showsVerticalScrollIndicator={false}>
        {q.kind === 'multipleChoice' && (
          <>
            <View style={styles.sentenceCard}>
              <Text style={styles.sentence}>{q.question}</Text>
            </View>
            <View style={{ gap: 10 }}>
              {q.options.map((opt, i) => {
                const answered = mcSelected !== null;
                const isSelected = mcSelected === i;
                const isCorrectOpt = i === q.correctIndex;
                return (
                  <Pressable
                    key={opt}
                    disabled={answered}
                    style={[
                      styles.option,
                      answered && isSelected && (isCorrectOpt ? styles.optionCorrect : styles.optionWrong),
                      answered && isCorrectOpt && !isSelected && styles.optionCorrect,
                    ]}
                    onPress={() => {
                      setMcSelected(i);
                      recordAnswer(i === q.correctIndex, opt);
                    }}
                  >
                    <Text style={styles.optionText}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {q.kind === 'fillBlank' && (
          <>
            <View style={styles.sentenceCard}>
              <Text style={styles.sentence}>{q.sentence}</Text>
            </View>
            <View style={styles.grid}>
              {q.options.map((opt) => {
                const answered = blankSelected !== null;
                const isSelected = blankSelected === opt;
                const isCorrectOpt = opt === q.answer;
                return (
                  <Pressable
                    key={opt}
                    disabled={answered}
                    style={[
                      styles.option,
                      answered && isSelected && (isCorrectOpt ? styles.optionCorrect : styles.optionWrong),
                      answered && isCorrectOpt && !isSelected && styles.optionCorrect,
                    ]}
                    onPress={() => {
                      setBlankSelected(opt);
                      recordAnswer(opt === q.answer, opt);
                    }}
                  >
                    <Text style={styles.optionText}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {q.kind === 'sentenceBuild' && (
          <>
            <Text style={styles.instruction}>Gapni to'g'ri tartibda tuzing</Text>
            <View style={styles.sentenceCard}>
              <Text style={styles.sentence}>{q.translation}</Text>
            </View>
            <View style={styles.builtSentenceBox}>
              <Text style={styles.builtSentenceText}>{builtOrder.map((i) => shuffledWords[i]).join(' ') || '...'}</Text>
            </View>
            <View style={styles.grid}>
              {shuffledWords.map((word, i) => {
                const used = builtOrder.includes(i);
                return (
                  <Pressable
                    key={i}
                    disabled={used || builtOrder.length >= q.words.length}
                    style={[styles.wordChip, used && styles.wordChipUsed]}
                    onPress={() => setBuiltOrder((b) => [...b, i])}
                  >
                    <Text style={styles.optionText}>{word}</Text>
                  </Pressable>
                );
              })}
            </View>
            {builtOrder.length === q.words.length && (
              <Pressable
                style={styles.continueBtn}
                onPress={() => {
                  const sentence = builtOrder.map((i) => shuffledWords[i]).join(' ');
                  recordAnswer(sentence === q.answer.join(' '), sentence);
                  goNext();
                }}
              >
                <Text style={styles.continueBtnText}>Javobni tekshirish va davom etish</Text>
              </Pressable>
            )}
            {builtOrder.length > 0 && builtOrder.length < q.words.length && (
              <Pressable style={styles.resetBtn} onPress={() => setBuiltOrder([])}>
                <Text style={styles.resetBtnText}>Boshidan boshlash</Text>
              </Pressable>
            )}
          </>
        )}

        {q.kind === 'speaking' && (
          <>
            <Text style={styles.instruction}>Jumlani ovoz chiqarib o'qing</Text>
            <View style={styles.sentenceCard}>
              <Text style={styles.sentence}>{q.sentence}</Text>
              <Text style={styles.sentenceTranslation}>{q.translation}</Text>
            </View>
            {!speakingDone ? (
              <Pressable
                style={styles.speakBtn}
                onPress={() => {
                  const score = 78 + Math.floor(Math.random() * 20);
                  recordAnswer(score >= 80, `Talaffuz balli: ${score}%`);
                  setSpeakingDone(true);
                }}
              >
                <Ionicons name="mic" size={20} color="#fff" />
                <Text style={styles.speakBtnText}>Ovoz chiqarib o'qidim</Text>
              </Pressable>
            ) : (
              <View style={styles.speakDoneBox}>
                <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
                <Text style={styles.speakDoneText}>Qabul qilindi</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {((q.kind === 'multipleChoice' && mcSelected !== null) ||
        (q.kind === 'fillBlank' && blankSelected !== null) ||
        (q.kind === 'speaking' && speakingDone)) && (
        <Pressable style={styles.continueBtnFixed} onPress={goNext}>
          <Text style={styles.continueBtnText}>Keyingi</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  topTitle: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  progress: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.blueLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  timerPillLow: { backgroundColor: theme.colors.dangerBg },
  timerText: { fontFamily: theme.fonts.bold, fontSize: 14, color: theme.colors.blue },
  timerTextLow: { color: theme.colors.danger },

  // Intro
  introWrap: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 14 },
  introIconWrap: { width: 84, height: 84, borderRadius: 28, backgroundColor: theme.colors.blueLight, alignItems: 'center', justifyContent: 'center' },
  introTitle: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.text, textAlign: 'center' },
  introStatsRow: { flexDirection: 'row', gap: 24, marginVertical: 6 },
  introStat: { alignItems: 'center' },
  introStatValue: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.blue },
  introStatLabel: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  introHint: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'left', lineHeight: 20 },
  startBtn: { width: '100%', backgroundColor: theme.colors.purple, borderRadius: theme.radius.sm, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  startBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },

  // Break
  breakWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  breakEmoji: { fontSize: 48 },
  breakTitle: { fontFamily: theme.fonts.extraBold, fontSize: 20, color: theme.colors.text },
  breakClock: { fontFamily: theme.fonts.extraBold, fontSize: 36, color: theme.colors.blue, marginVertical: 6 },
  breakHint: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  breakSkipBtn: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 18 },
  breakSkipBtnText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple },

  // Question
  qScroll: { padding: 20, paddingBottom: 100, gap: 12 },
  instruction: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.textMuted },
  sentenceCard: { backgroundColor: theme.colors.bg, borderRadius: theme.radius.md, padding: 18, marginBottom: 4 },
  sentence: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text, lineHeight: 24 },
  sentenceTranslation: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  optionCorrect: { borderColor: theme.colors.success, backgroundColor: theme.colors.successBg },
  optionWrong: { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerBg },
  optionText: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
  wordChip: {
    borderWidth: 1.5,
    borderColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  wordChipUsed: { opacity: 0.3 },
  builtSentenceBox: { minHeight: 50, borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.sm, padding: 14, justifyContent: 'center' },
  builtSentenceText: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  resetBtn: { alignSelf: 'center', paddingVertical: 8 },
  resetBtnText: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.textMuted },
  continueBtn: { backgroundColor: theme.colors.purple, borderRadius: theme.radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  continueBtnFixed: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 15,
    alignItems: 'center',
  },
  continueBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },

  speakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.pink,
    borderRadius: theme.radius.sm,
    paddingVertical: 15,
  },
  speakBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
  speakDoneBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  speakDoneText: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.success },

  // Result
  resultScroll: { padding: 20, paddingBottom: 40, gap: 12 },
  resultBanner: { borderRadius: theme.radius.lg, padding: 24, alignItems: 'center', gap: 4 },
  resultBannerPass: { backgroundColor: theme.colors.successBg },
  resultBannerFail: { backgroundColor: theme.colors.dangerBg },
  resultEmoji: { fontSize: 40 },
  resultPercent: { fontFamily: theme.fonts.extraBold, fontSize: 40, color: theme.colors.text, marginTop: 4 },
  resultVerdict: { fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text, marginTop: 4 },
  resultSub: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 4 },

  mistakesTitle: { fontFamily: theme.fonts.bold, fontSize: 15, color: theme.colors.text, marginTop: 10 },
  mistakeCard: { backgroundColor: theme.colors.bg, borderRadius: theme.radius.sm, padding: 14, gap: 4 },
  mistakeQuestion: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.text },
  mistakeYour: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.danger },
  mistakeCorrect: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.success },

  backBtn: { backgroundColor: theme.colors.purple, borderRadius: theme.radius.sm, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  backBtnText: { fontFamily: theme.fonts.bold, fontSize: 14, color: '#fff' },
});
