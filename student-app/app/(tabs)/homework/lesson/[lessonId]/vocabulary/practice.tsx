import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay';
import { CoinPill } from '@/components/ui/CoinIcon';
import { LightningPill } from '@/components/ui/LightningIcon';
import { theme } from '@/constants/theme';
import { getResolvedLessonContent, LessonContent, VOCAB_PRACTICE_SIZE, VocabWord } from '@/data/lessonContent';
import { reportActivity } from '@/services/activitySync';
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
  const [finished, setFinished] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [earnedLightning, setEarnedLightning] = useState(0);

  // Noto'g'ri javob berilgan so'z darhol tashlab yuborilmaydi — shu bosqich
  // (round) navbatining oxiriga qo'shilib, to'g'ri javob berilgunicha
  // qayta-qayta so'raladi. Har bir bosqich boshida navbat to'liq so'zlar
  // ro'yxatidan qayta tuziladi.
  const [roundQueue, setRoundQueue] = useState<VocabWord[] | null>(null);
  useEffect(() => {
    if (words.length && !roundQueue) setRoundQueue(words);
  }, [words, roundQueue]);

  const totalSteps = words.length * STEP_LABELS.length;

  if (!content || !roundQueue) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.resultCenter}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  const current = roundQueue[0];
  const completedSteps = round * words.length + (words.length - roundQueue.length);

  const advance = (correct: boolean) => {
    if (correct) {
      addCoins(1, String(lessonId));
      addLightning(1);
      setEarnedCoins((c) => c + 1);
      setEarnedLightning((l) => l + 1);
    } else {
      setWrongAttempts((w) => w + 1);
    }

    const rest = roundQueue.slice(1);
    const nextQueue = correct ? rest : [...rest, current];
    if (nextQueue.length > 0) {
      setRoundQueue(nextQueue);
      return;
    }
    if (round + 1 < STEP_LABELS.length) {
      setRound(round + 1);
      setRoundQueue(words);
      return;
    }
    markDone(String(lessonId), 'vocabPractice');
    saveLastPosition({ lessonId: String(lessonId), section: 'vocabulary/practice', label: "O'rganish, yodlash, takrorlash" });
    reportActivity({ type: 'vocab', label: `${lessonId} - Lug'at mashqi`, wrongAttempts });
    setFinished(true);
  };

  if (finished) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <FinishedScreen
          wordsCount={words.length}
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
        <Text style={styles.topTitle}>{STEP_LABELS[round]}</Text>
        <Text style={styles.progress}>
          {completedSteps} / {totalSteps}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(completedSteps / totalSteps) * 100}%` }]} />
      </View>

      {round === 0 && <ChooseTranslationStep key={current.id} word={current} allWords={words} onDone={advance} />}
      {round === 1 && <ConstructWordStep key={current.id} word={current} onDone={advance} />}
      {round === 2 && <PronounceWordStep key={current.id} word={current} onDone={advance} />}
    </SafeAreaView>
  );
}

function FinishedScreen({
  wordsCount,
  wrongAttempts,
  earnedCoins,
  earnedLightning,
}: {
  wordsCount: number;
  wrongAttempts: number;
  earnedCoins: number;
  earnedLightning: number;
}) {
  const [celebrating, setCelebrating] = useState(true);
  return (
    <View style={styles.resultCenter}>
      <Text style={styles.resultEmoji}>📚</Text>
      <Text style={styles.resultTitle}>Ajoyib!</Text>
      <Text style={styles.resultSubtitle}>{wordsCount} ta so'z bo'yicha 3 bosqichli mashqni muvaffaqiyatli yakunladingiz!</Text>
      {wrongAttempts > 0 && <Text style={styles.resultSubtitle}>{wrongAttempts} marta qayta urinildi</Text>}
      <View style={styles.rewardsRow}>
        <CoinPill amount={earnedCoins} />
        <LightningPill amount={earnedLightning} />
      </View>
      <Pressable style={styles.resultBtn} onPress={() => router.back()}>
        <Text style={styles.resultBtnText}>Orqaga qaytish</Text>
      </Pressable>
      <CelebrationOverlay visible={celebrating} onFinish={() => setCelebrating(false)} />
    </View>
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

  // Xato harf qo'yilganda butun so'zni Tozalash orqali boshidan yozish shart
  // emas — qurilgan qatordagi oxirgi harfga bosish xuddi backspace kabi faqat
  // o'sha bitta harfni olib tashlaydi.
  const removeLast = () => {
    if (built.length === 0) return;
    const lastIdx = built[built.length - 1];
    setUsed((u) => u.map((v, i) => (i === lastIdx ? false : v)));
    setBuilt((b) => b.slice(0, -1));
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
        {letters.map((_, i) => {
          const isFilled = built[i] !== undefined;
          const isLastFilled = isFilled && i === built.length - 1;
          return (
            <Pressable
              key={i}
              style={styles.builtSlot}
              disabled={!isLastFilled || isComplete}
              onPress={removeLast}>
              <Text style={styles.builtSlotText}>{isFilled ? letters[built[i]] : ''}</Text>
            </Pressable>
          );
        })}
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

// So'zni taqqoslashdan oldin normallashtiradi (katta-kichik harf, tinish
// belgilari, bosh-oxiridagi bo'shliqlar farq qilmasligi uchun) — brauzer
// nutqni tanish natijasi ba'zan katta harf yoki nuqta bilan qaytarishi mumkin.
function normalizeSpoken(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z']/g, '');
}

type PronounceStatus = 'idle' | 'listening' | 'correct' | 'wrong' | 'unsupported' | 'error';

// Safari (ayniqsa iOS'da) Chrome'dan farqli ishlaydi: gapirish tugaganda
// o'zi avtomatik `onresult` chaqirmaydi — natija olish uchun aniq `stop()`
// chaqirilishi shart. Hatto shundan keyin ham WebKit'ning ba'zi versiyalarida
// (bilan tanish xizmati vaqtincha ishlamay qolganda) hech qanday hodisa
// umuman chaqirilmasligi mumkin — shu sabab ikkita xavfsizlik choralari bor:
// 1) foydalanuvchi o'zi to'xtatmasa ham, belgilangan vaqtdan keyin avtomatik
//    `stop()` chaqiriladi; 2) shundan keyin ham hech narsa bo'lmasa, majburiy
//    xato holatiga o'tkaziladi — cheksiz "tinglanmoqda" holatida qolib
//    ketmasligi uchun.
const AUTO_STOP_MS = 4500;
const HANG_FAILSAFE_MS = 8000;

function PronounceWordStep({ word, onDone }: { word: VocabWord; onDone: (correct: boolean) => void }) {
  const [status, setStatus] = useState<PronounceStatus>('idle');
  const [heardText, setHeardText] = useState('');
  const recognitionRef = useRef<any>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hangTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (autoStopTimerRef.current) { clearTimeout(autoStopTimerRef.current); autoStopTimerRef.current = null; }
    if (hangTimerRef.current) { clearTimeout(hangTimerRef.current); hangTimerRef.current = null; }
  };

  useEffect(() => {
    return () => {
      clearTimers();
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore — komponent unmount bo'lganda tinlashni to'xtatish shart emas.
      }
    };
  }, []);

  // Real ovoz tanish uchun brauzerning o'zidagi Web Speech API'dan (Chrome,
  // Safari, Edge) foydalaniladi — alohida server yoki API kalit shart emas.
  // Talaffuz aynan aytilgan so'z (word.english) bilan mos kelgandagina
  // "to'g'ri" deb qabul qilinadi, avvalgidek shunchaki ovoz yozib olinishi
  // bilan avtomatik to'g'ri deb hisoblanmaydi.
  const startListening = () => {
    const SpeechRecognitionCtor: any =
      Platform.OS === 'web' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
    if (!SpeechRecognitionCtor) {
      setStatus('unsupported');
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.onresult = (event: any) => {
      clearTimers();
      const alternatives: string[] = Array.from(event.results[0]).map((r: any) => r.transcript as string);
      const target = normalizeSpoken(word.english);
      const matched = alternatives.some((t) => normalizeSpoken(t) === target);
      setHeardText(alternatives[0] || '');
      setStatus(matched ? 'correct' : 'wrong');
    };
    recognition.onerror = () => {
      clearTimers();
      setStatus('error');
    };
    recognition.onend = () => {
      clearTimers();
      setStatus((s) => (s === 'listening' ? 'error' : s));
    };
    recognitionRef.current = recognition;
    setHeardText('');
    setStatus('listening');
    recognition.start();

    autoStopTimerRef.current = setTimeout(() => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    }, AUTO_STOP_MS);
    hangTimerRef.current = setTimeout(() => {
      setStatus((s) => (s === 'listening' ? 'error' : s));
    }, HANG_FAILSAFE_MS);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const retry = () => setStatus('idle');
  const isDone = status === 'correct' || status === 'wrong';

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
        <Pressable
          style={[styles.micBtn, status === 'listening' && styles.micBtnActive]}
          onPress={status === 'listening' ? stopListening : startListening}>
          <Ionicons name={status === 'listening' ? 'stop' : 'mic'} size={30} color="#fff" />
        </Pressable>
        {status === 'listening' && <Text style={styles.recordedText}>Tinglanmoqda... gapiring</Text>}
        {status === 'unsupported' && (
          <Text style={[styles.recordedText, { color: theme.colors.danger }]}>
            Brauzeringiz ovozni aniqlashni qo'llab-quvvatlamaydi
          </Text>
        )}
        {status === 'error' && (
          <Text style={[styles.recordedText, { color: theme.colors.danger }]}>
            Ovoz eshitilmadi, qaytadan urinib ko'ring
          </Text>
        )}
        {isDone && (
          <View style={{ gap: 6, alignItems: 'center' }}>
            <View style={styles.recordedBadge}>
              <Ionicons
                name={status === 'correct' ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={status === 'correct' ? theme.colors.success : theme.colors.danger}
              />
              <Text style={[styles.recordedText, { color: status === 'correct' ? theme.colors.success : theme.colors.danger }]}>
                {status === 'correct' ? "To'g'ri talaffuz!" : `Eshitildi: "${heardText || '—'}"`}
              </Text>
            </View>
            {status === 'wrong' && (
              <Pressable onPress={retry} hitSlop={8}>
                <Text style={{ fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.purple }}>Qayta urinish</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
      {isDone && (
        <Pressable style={styles.continueBtn} onPress={() => onDone(status === 'correct')}>
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
