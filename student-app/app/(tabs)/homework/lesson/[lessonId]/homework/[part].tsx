import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatThreadView } from '@/components/chat/ChatThreadView';
import { CelebrationOverlay } from '@/components/ui/CelebrationOverlay';
import { theme } from '@/constants/theme';
import { useLang } from '@/i18n/LanguageContext';
import { ChatMessage } from '@/data/mock';
import { getResolvedLessonContent, HomeworkPart, LessonContent, MatchPair, MultipleChoiceQ, SentenceBuildQ } from '@/data/lessonContent';
import { reportActivity } from '@/services/activitySync';
import { addCoins } from '@/services/coinsStore';
import { addLightning } from '@/services/lightningStore';
import { markHomeworkPartDone } from '@/services/lessonProgressStore';
import { fetchMobileContent } from '@/services/contentApi';
import { fetchCreativeSubmission, submitCreativeSubmission } from '@/services/creativeSubmissionApi';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function HomeworkPartScreen() {
  const { t } = useLang();
  const { lessonId, part: partId, day } = useLocalSearchParams<{ lessonId: string; part: string; day?: string }>();
  const dayIndex = day === 'speaking' ? 1 : 0;
  const [content, setContent] = useState<LessonContent | null>(null);

  useEffect(() => {
    getResolvedLessonContent(String(lessonId), dayIndex).then(setContent);
  }, [lessonId, dayIndex]);

  const complete = () => markHomeworkPartDone(String(lessonId), String(partId));

  if (!content) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  const part = content.homeworkParts.find((p) => p.id === partId) as HomeworkPart | undefined;

  if (!part) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('hwp_not_found')}</Text>
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
        <Text style={styles.topTitle}>{part.title}</Text>
        <View style={{ width: 28 }} />
      </View>

      {part.kind === 'matching' && <MatchingPart pairs={part.pairs} onDone={complete} lessonId={String(lessonId)} />}
      {part.kind === 'fillBlank' && <FillBlankPart blanks={part.blanks} onDone={complete} lessonId={String(lessonId)} />}
      {part.kind === 'multipleChoice' && <MultipleChoicePart questions={part.questions} onDone={complete} lessonId={String(lessonId)} />}
      {part.kind === 'sentenceBuild' && <SentenceBuildPart items={part.items} onDone={complete} lessonId={String(lessonId)} />}
      {part.kind === 'record' && <RecordPart prompts={part.prompts} onDone={complete} lessonId={String(lessonId)} />}
      {part.kind === 'pronunciation' && <PronunciationPart prompts={part.prompts} onDone={complete} lessonId={String(lessonId)} />}
      {part.kind === 'roleplay' && <RoleplayPart scenario={part.scenario} onDone={complete} lessonId={String(lessonId)} />}
      {part.kind === 'creative' && (
        <CreativePart
          instruction={part.instruction}
          mediaType={part.mediaType}
          onDone={complete}
          lessonId={String(lessonId)}
          category={content.dayType === 'speaking' ? 'speaking' : 'video'}
        />
      )}
    </SafeAreaView>
  );
}

// PASS_THRESHOLD — savol-javobli mashqlarda (matching, fill-blank, MC, sentence-build)
// keyingi darsni ochish uchun kamida shuncha foiz to'g'ri javob berilishi kerak.
const PASS_THRESHOLD = 0.65;

function DoneScreen({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  const { t } = useLang();
  const [celebrating, setCelebrating] = useState(true);
  return (
    <View style={styles.resultCenter}>
      <Text style={styles.resultEmoji}>{emoji}</Text>
      <Text style={styles.resultTitle}>{title}</Text>
      <Text style={styles.resultSubtitle}>{subtitle}</Text>
      <Pressable style={styles.resultBtn} onPress={() => router.back()}>
        <Text style={styles.resultBtnText}>{t('ex_back_btn')}</Text>
      </Pressable>
      <CelebrationOverlay visible={celebrating} onFinish={() => setCelebrating(false)} />
    </View>
  );
}

// Agar to'g'ri javoblar PASS_THRESHOLD'dan kam bo'lsa — dars "o'tilgan" deb
// belgilanmaydi, o'quvchi qayta urinib ko'rishi kerak.
function RetryScreen({ percent, onRetry }: { percent: number; onRetry: () => void }) {
  const { t } = useLang();
  return (
    <View style={styles.resultCenter}>
      <Text style={styles.resultEmoji}>💪</Text>
      <Text style={styles.resultTitle}>{t('hwp_retry_title')}</Text>
      <Text style={styles.resultSubtitle}>
        {t('hwp_retry_sub').replace('{percent}', String(percent)).replace('{threshold}', String(Math.round(PASS_THRESHOLD * 100)))}
      </Text>
      <Pressable style={styles.resultBtn} onPress={onRetry}>
        <Text style={styles.resultBtnText}>{t('hwp_retry_btn')}</Text>
      </Pressable>
    </View>
  );
}

// ─── PART A (grammar) — Matching ────────────────────────────────────────────
function MatchingPart({ pairs, onDone, lessonId }: { pairs: MatchPair[]; onDone: () => void; lessonId: string }) {
  const { t } = useLang();
  const rightItems = useMemo(() => shuffle(pairs.map((p) => ({ id: p.id, label: p.right }))), [pairs]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState<{ left: string; right: string } | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [tooLow, setTooLow] = useState<number | null>(null);

  const tapLeft = (id: string) => {
    if (matched.has(id)) return;
    setSelectedLeft(id);
  };

  const tapRight = (id: string) => {
    if (!selectedLeft || matched.has(id)) return;
    if (selectedLeft === id) {
      const next = new Set(matched);
      next.add(id);
      setMatched(next);
      setSelectedLeft(null);
      addCoins(1, lessonId);
      addLightning(1);
      if (next.size === pairs.length) {
        const accuracy = pairs.length / (pairs.length + wrongCount);
        if (accuracy >= PASS_THRESHOLD) {
          onDone();
          reportActivity({ type: 'homework', label: `${lessonId} - Moslashtirish`, scorePercent: Math.round(accuracy * 100) });
          setTimeout(() => setFinished(true), 500);
        } else {
          setTimeout(() => setTooLow(Math.round(accuracy * 100)), 500);
        }
      }
    } else {
      setWrongCount((c) => c + 1);
      setWrongFlash({ left: selectedLeft, right: id });
      setTimeout(() => {
        setWrongFlash(null);
        setSelectedLeft(null);
      }, 500);
    }
  };

  const retry = () => {
    setMatched(new Set());
    setSelectedLeft(null);
    setWrongFlash(null);
    setWrongCount(0);
    setTooLow(null);
  };

  if (finished) return <DoneScreen emoji="✅" title={t('hwp_matching_done_title')} subtitle={t('hwp_matching_done_sub').replace('{n}', String(pairs.length))} />;
  if (tooLow !== null) return <RetryScreen percent={tooLow} onRetry={retry} />;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.instruction}>{t('hwp_matching_instruction')}</Text>
      <View style={styles.matchColumns}>
        <View style={styles.matchColumn}>
          {pairs.map((p) => (
            <Pressable
              key={p.id}
              disabled={matched.has(p.id)}
              style={[
                styles.matchTile,
                selectedLeft === p.id && styles.matchTileSelected,
                matched.has(p.id) && styles.matchTileDone,
                wrongFlash?.left === p.id && styles.matchTileWrong,
              ]}
              onPress={() => tapLeft(p.id)}>
              <Text style={styles.matchTileText}>{p.left}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.matchColumn}>
          {rightItems.map((r) => (
            <Pressable
              key={r.id}
              disabled={matched.has(r.id)}
              style={[
                styles.matchTile,
                matched.has(r.id) && styles.matchTileDone,
                wrongFlash?.right === r.id && styles.matchTileWrong,
              ]}
              onPress={() => tapRight(r.id)}>
              <Text style={styles.matchTileText}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={styles.matchProgress}>
        {t('hwp_matching_progress').replace('{matched}', String(matched.size)).replace('{total}', String(pairs.length))}
      </Text>
    </View>
  );
}

// ─── PART B (grammar) — Fill in the blank ───────────────────────────────────
function FillBlankPart({ blanks, onDone, lessonId }: { blanks: { id: string; sentence: string; answer: string; options: string[] }[]; onDone: () => void; lessonId: string }) {
  const { t } = useLang();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [tooLow, setTooLow] = useState<number | null>(null);
  const current = blanks[index];
  const answered = selected !== null;
  const isCorrect = selected === current?.answer;

  const next = () => {
    const nextCorrectCount = isCorrect ? correctCount + 1 : correctCount;
    if (isCorrect) {
      addCoins(1, lessonId);
      addLightning(1);
    }
    if (index + 1 >= blanks.length) {
      const accuracy = nextCorrectCount / blanks.length;
      if (accuracy >= PASS_THRESHOLD) {
        onDone();
        reportActivity({ type: 'homework', label: `${lessonId} - Bo'sh joy to'ldirish`, scorePercent: Math.round(accuracy * 100) });
        setFinished(true);
      } else {
        setTooLow(Math.round(accuracy * 100));
      }
      return;
    }
    setCorrectCount(nextCorrectCount);
    setIndex(index + 1);
    setSelected(null);
  };

  const retry = () => {
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setTooLow(null);
  };

  if (finished) return <DoneScreen emoji="✍️" title={t('hwp_fillblank_done_title')} subtitle={t('hwp_fillblank_done_sub').replace('{n}', String(blanks.length))} />;
  if (tooLow !== null) return <RetryScreen percent={tooLow} onRetry={retry} />;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.instruction}>
        {t('hwp_fillblank_instruction').replace('{current}', String(index + 1)).replace('{total}', String(blanks.length))}
      </Text>
      <View style={styles.sentenceCard}>
        <Text style={styles.sentence}>{current.sentence}</Text>
      </View>
      <View style={styles.grid}>
        {current.options.map((opt) => {
          const isSelected = selected === opt;
          return (
            <Pressable
              key={opt}
              disabled={answered}
              style={[
                styles.option,
                answered && isSelected && (isCorrect ? styles.optionCorrect : styles.optionWrong),
                answered && opt === current.answer && !isSelected && styles.optionCorrect,
              ]}
              onPress={() => setSelected(opt)}>
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {answered && (
        <Pressable style={styles.continueBtn} onPress={next}>
          <Text style={styles.continueBtnText}>{t('common_keyingi')}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── PART C (grammar) — Multiple choice ─────────────────────────────────────
function MultipleChoicePart({ questions, onDone, lessonId }: { questions: MultipleChoiceQ[]; onDone: () => void; lessonId: string }) {
  const { t } = useLang();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [tooLow, setTooLow] = useState<number | null>(null);
  const current = questions[index];
  const answered = selected !== null;
  const isCorrect = selected === current?.correctIndex;

  const next = () => {
    const nextCorrectCount = isCorrect ? correctCount + 1 : correctCount;
    if (isCorrect) {
      addCoins(1, lessonId);
      addLightning(1);
    }
    if (index + 1 >= questions.length) {
      const accuracy = nextCorrectCount / questions.length;
      if (accuracy >= PASS_THRESHOLD) {
        onDone();
        reportActivity({ type: 'homework', label: `${lessonId} - Testlar`, scorePercent: Math.round(accuracy * 100) });
        setFinished(true);
      } else {
        setTooLow(Math.round(accuracy * 100));
      }
      return;
    }
    setCorrectCount(nextCorrectCount);
    setIndex(index + 1);
    setSelected(null);
  };

  const retry = () => {
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setTooLow(null);
  };

  if (finished) return <DoneScreen emoji="🎯" title={t('hwp_mc_done_title')} subtitle={t('hwp_mc_done_sub').replace('{n}', String(questions.length))} />;
  if (tooLow !== null) return <RetryScreen percent={tooLow} onRetry={retry} />;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.instruction}>
        {index + 1}/{questions.length}
      </Text>
      <View style={styles.sentenceCard}>
        <Text style={styles.sentence}>{current.question}</Text>
      </View>
      <View style={{ gap: 10 }}>
        {current.options.map((opt, i) => {
          const isSelected = selected === i;
          return (
            <Pressable
              key={opt}
              disabled={answered}
              style={[
                styles.mcOption,
                answered && isSelected && (isCorrect ? styles.optionCorrect : styles.optionWrong),
                answered && i === current.correctIndex && !isSelected && styles.optionCorrect,
              ]}
              onPress={() => setSelected(i)}>
              <Text style={styles.optionText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      {answered && (
        <Pressable style={styles.continueBtn} onPress={next}>
          <Text style={styles.continueBtnText}>{t('common_keyingi')}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── PART D (grammar) — Sentence building ───────────────────────────────────
function SentenceBuildPart({ items, onDone, lessonId }: { items: SentenceBuildQ[]; onDone: () => void; lessonId: string }) {
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [tooLow, setTooLow] = useState<number | null>(null);
  const current = items[index];

  const retry = () => {
    setIndex(0);
    setCorrectCount(0);
    setTooLow(null);
  };

  if (tooLow !== null) return <RetryScreen percent={tooLow} onRetry={retry} />;

  return (
    <SentenceBuildRound
      key={current.id}
      item={current}
      lessonId={lessonId}
      onNext={(roundCorrect) => {
        const nextCorrectCount = roundCorrect ? correctCount + 1 : correctCount;
        if (index + 1 >= items.length) {
          const accuracy = nextCorrectCount / items.length;
          if (accuracy >= PASS_THRESHOLD) {
            onDone();
            reportActivity({ type: 'homework', label: `${lessonId} - Gap tuzish`, scorePercent: Math.round(accuracy * 100) });
            setFinished(true);
          } else {
            setTooLow(Math.round(accuracy * 100));
          }
        } else {
          setCorrectCount(nextCorrectCount);
          setIndex(index + 1);
        }
      }}
      finished={finished}
      total={items.length}
    />
  );
}

function SentenceBuildRound({ item, onNext, finished, total, lessonId }: { item: SentenceBuildQ; onNext: (correct: boolean) => void; finished: boolean; total: number; lessonId: string }) {
  const { t } = useLang();
  const words = useMemo(() => shuffle(item.words), [item]);
  const [used, setUsed] = useState<boolean[]>(() => words.map(() => false));
  const [built, setBuilt] = useState<number[]>([]);

  if (finished) return <DoneScreen emoji="🧩" title={t('hwp_matching_done_title')} subtitle={t('hwp_sentence_build_done_sub').replace('{n}', String(total))} />;

  const tap = (i: number) => {
    if (used[i]) return;
    setUsed((u) => u.map((v, idx) => (idx === i ? true : v)));
    setBuilt((b) => [...b, i]);
  };

  const reset = () => {
    setUsed(words.map(() => false));
    setBuilt([]);
  };

  const isComplete = built.length === words.length;
  const builtSentence = built.map((i) => words[i]).join(' ');
  const isCorrect = builtSentence === item.answer.join(' ');

  return (
    <View style={styles.stepContent}>
      <Text style={styles.instruction}>{t('exam_sentence_build_instruction')}</Text>
      <View style={styles.sentenceCard}>
        <Text style={styles.sentence}>{item.translation}</Text>
      </View>
      <View style={styles.builtSentenceBox}>
        <Text style={styles.builtSentenceText}>{builtSentence || '...'}</Text>
      </View>
      <View style={styles.grid}>
        {words.map((w, i) => (
          <Pressable key={i} disabled={used[i]} style={[styles.wordChip, used[i] && styles.wordChipUsed]} onPress={() => tap(i)}>
            <Text style={styles.wordChipText}>{w}</Text>
          </Pressable>
        ))}
      </View>
      {isComplete ? (
        <View style={{ gap: 10, marginTop: 8 }}>
          <Text style={[styles.feedbackText, { color: isCorrect ? theme.colors.success : theme.colors.danger }]}>
            {isCorrect ? t('vp_correct') : `${t('exam_correct_answer')} ${item.answer.join(' ')}`}
          </Text>
          <Pressable
            style={styles.continueBtn}
            onPress={() => {
              if (isCorrect) {
                addCoins(1, lessonId);
                addLightning(1);
              }
              onNext(isCorrect);
            }}>
            <Text style={styles.continueBtnText}>{t('common_keyingi')}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.resetBtn} onPress={reset}>
          <Ionicons name="refresh" size={16} color={theme.colors.textMuted} />
          <Text style={styles.resetBtnText}>{t('vp_clear_btn')}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── PART A (speaking) — Record yourself ────────────────────────────────────
function RecordPart({ prompts, onDone, lessonId }: { prompts: { id: string; sentence: string; translation: string }[]; onDone: () => void; lessonId: string }) {
  const { t } = useLang();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [index, setIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [finished, setFinished] = useState(false);
  const current = prompts[index];

  const toggle = async () => {
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

  const next = () => {
    addCoins(1, lessonId);
    addLightning(1);
    if (index + 1 >= prompts.length) {
      onDone();
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setRecorded(false);
  };

  if (finished) return <DoneScreen emoji="🎙️" title={t('hwp_record_done_title')} subtitle={t('hwp_record_done_sub').replace('{n}', String(prompts.length))} />;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.instruction}>
        {t('hwp_record_instruction').replace('{current}', String(index + 1)).replace('{total}', String(prompts.length))}
      </Text>
      <View style={styles.sentenceCard}>
        <Text style={styles.sentence}>{current.sentence}</Text>
        <Text style={styles.sentenceTranslation}>{current.translation}</Text>
      </View>
      <View style={styles.pronounceArea}>
        <Pressable style={[styles.micBtn, isRecording && styles.micBtnActive]} onPress={toggle}>
          <Ionicons name={isRecording ? 'stop' : 'mic'} size={30} color="#fff" />
        </Pressable>
        {recorded && (
          <View style={styles.recordedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
            <Text style={styles.recordedText}>{t('hwp_record_recorded')}</Text>
          </View>
        )}
      </View>
      {recorded && (
        <Pressable style={styles.continueBtn} onPress={next}>
          <Text style={styles.continueBtnText}>{t('common_keyingi')}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── PART C (speaking) — Pronunciation check ────────────────────────────────
function PronunciationPart({ prompts, onDone, lessonId }: { prompts: { id: string; sentence: string; translation: string }[]; onDone: () => void; lessonId: string }) {
  const { t } = useLang();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [index, setIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const current = prompts[index];

  const toggle = async () => {
    if (isRecording) {
      setIsRecording(false);
      await recorder.stop();
      setScore(78 + Math.floor(Math.random() * 20));
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
  };

  const next = () => {
    if (score !== null && score >= 80) {
      addCoins(1, lessonId);
      addLightning(1);
    }
    if (index + 1 >= prompts.length) {
      onDone();
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setScore(null);
  };

  if (finished) return <DoneScreen emoji="🌟" title={t('hwp_fillblank_done_title')} subtitle={t('hwp_pron_done_sub').replace('{n}', String(prompts.length))} />;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.instruction}>
        {t('hwp_pron_instruction').replace('{current}', String(index + 1)).replace('{total}', String(prompts.length))}
      </Text>
      <View style={styles.sentenceCard}>
        <Text style={styles.sentence}>{current.sentence}</Text>
        <Text style={styles.sentenceTranslation}>{current.translation}</Text>
      </View>
      <View style={styles.pronounceArea}>
        <Pressable style={[styles.micBtn, isRecording && styles.micBtnActive]} onPress={toggle}>
          <Ionicons name={isRecording ? 'stop' : 'mic'} size={30} color="#fff" />
        </Pressable>
        {score !== null && (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeText}>{score}%</Text>
            <Text style={styles.scoreBadgeLabel}>{score >= 90 ? t('hwp_pron_excellent') : score >= 80 ? t('hwp_pron_good') : t('hwp_pron_practice_more')}</Text>
          </View>
        )}
      </View>
      {score !== null && (
        <Pressable style={styles.continueBtn} onPress={next}>
          <Text style={styles.continueBtnText}>{t('common_keyingi')}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── PART B (speaking) — AI roleplay ────────────────────────────────────────
function RoleplayPart({ scenario, onDone, lessonId }: { scenario: { id: string; title: string; intro: string; lines: string[]; closing: string }; onDone: () => void; lessonId: string }) {
  const { t } = useLang();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'intro', chatId: scenario.id, from: 'them', type: 'text', text: scenario.lines[0], time: 'hozir' },
  ]);
  const [lineIndex, setLineIndex] = useState(1);
  const [ended, setEnded] = useState(false);

  const advanceBot = (history: ChatMessage[]) => {
    setTimeout(() => {
      if (lineIndex < scenario.lines.length) {
        setMessages([...history, { id: `bot-${lineIndex}`, chatId: scenario.id, from: 'them', type: 'text', text: scenario.lines[lineIndex], time: 'hozir' }]);
        setLineIndex((i) => i + 1);
      } else if (!ended) {
        setMessages([...history, { id: 'closing', chatId: scenario.id, from: 'them', type: 'text', text: scenario.closing, time: 'hozir' }]);
        setEnded(true);
        onDone();
      }
    }, 700);
  };

  const onSendText = (text: string) => {
    const next: ChatMessage[] = [...messages, { id: `me-${Date.now()}`, chatId: scenario.id, from: 'me', type: 'text', text, time: 'hozir' }];
    setMessages(next);
    addCoins(1, lessonId);
    addLightning(1);
    advanceBot(next);
  };

  const onSendVoice = (uri: string, durationSeconds?: number) => {
    const next: ChatMessage[] = [
      ...messages,
      { id: `me-${Date.now()}`, chatId: scenario.id, from: 'me', type: 'voice', voiceUri: uri, voiceDuration: durationSeconds, time: 'hozir' },
    ];
    setMessages(next);
    addCoins(1, lessonId);
    addLightning(1);
    advanceBot(next);
  };

  const onSendImage = () => {};

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.roleplayIntro}>{scenario.intro}</Text>
      <ChatThreadView messages={messages} onSendText={onSendText} onSendImage={onSendImage} onSendVoice={onSendVoice} />
      {ended && (
        <Pressable style={styles.roleplayDoneBtn} onPress={() => router.back()}>
          <Text style={styles.continueBtnText}>{t('hwp_roleplay_done_btn')}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Ijodiy vazifa ───────────────────────────────────────────────────────────
// 148-ish: submission endi haqiqiy serverga boradi (ustoz kabinetiga) va
// ustoz "Qabul qilish" tugmasini bosmaguncha 'pending'da qoladi — shu
// tufayli onDone() (darsning umumiy progressini 100%ga olib boruvchi belgi)
// faqat haqiqiy baholanganda chaqiriladi, submit paytida emas.
type CreativeStatus = 'checking' | 'draft' | 'pending' | 'graded';

function CreativePart({
  instruction,
  mediaType,
  onDone,
  lessonId,
  category,
}: {
  instruction: string;
  mediaType: 'text' | 'audio';
  onDone: () => void;
  lessonId: string;
  category: 'video' | 'speaking';
}) {
  const { t } = useLang();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [status, setStatus] = useState<CreativeStatus>('checking');
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gradedScore, setGradedScore] = useState<number | null>(null);
  const [gradedFeedback, setGradedFeedback] = useState<string | null>(null);

  // Ekran ochilganda avval serverdagi haqiqiy holatni tekshiramiz — masalan
  // o'quvchi vazifani yuborib chiqib ketgan va qaytib kirgan bo'lishi mumkin.
  useEffect(() => {
    let cancelled = false;
    fetchCreativeSubmission(lessonId).then((record) => {
      if (cancelled) return;
      if (record?.status === 'graded') {
        setGradedScore(record.scorePercent);
        setGradedFeedback(record.feedback);
        setStatus('graded');
        onDone();
      } else if (record?.status === 'pending') {
        setStatus('pending');
      } else {
        setStatus('draft');
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  // 'pending' bo'lganda ustoz qabul qilganini aniqlash uchun davriy tekshirish.
  useEffect(() => {
    if (status !== 'pending') return;
    let cancelled = false;
    const poll = setInterval(async () => {
      const record = await fetchCreativeSubmission(lessonId);
      if (cancelled || !record || record.status !== 'graded') return;
      setGradedScore(record.scorePercent);
      setGradedFeedback(record.feedback);
      setStatus('graded');
      addLightning(1);
      onDone();
    }, 8000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, lessonId]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    setImageUri(result.assets[0].uri);
  };

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

  const submit = async () => {
    setSubmitting(true);
    const mc = await fetchMobileContent().catch(() => null);
    const lessonTitle = mc?.lessons.find((l) => l.id === lessonId)?.name || lessonId;
    await submitCreativeSubmission({
      lessonId,
      lessonTitle,
      category,
      mediaType,
      text: mediaType === 'text' ? text : '',
      imageUri: mediaType === 'text' ? imageUri : null,
      audioUri: mediaType === 'audio' ? recorder.uri : null,
    });
    setSubmitting(false);
    setStatus('pending');
    addCoins(1, lessonId);
  };

  const canSubmit = mediaType === 'text' ? text.trim().length > 0 : recorded;

  if (status === 'checking') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.purple} />
      </View>
    );
  }

  if (status === 'graded') {
    return (
      <View style={styles.stepContent}>
        <View style={styles.gradedCard}>
          <Ionicons name="ribbon-outline" size={40} color={theme.colors.success} />
          <Text style={styles.gradedScore}>{gradedScore ?? 100} / 100</Text>
          <Text style={styles.gradedFeedback}>"{gradedFeedback || t('hwp_creative_graded_feedback_fallback')}" {t('hwp_creative_teacher_suffix')}</Text>
        </View>
        <Pressable style={styles.continueBtn} onPress={() => router.back()}>
          <Text style={styles.continueBtnText}>{t('ex_back_btn')}</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={styles.stepContent}>
        <View style={styles.pendingCard}>
          <Ionicons name="time-outline" size={40} color={theme.colors.warning} />
          <Text style={styles.pendingTitle}>{t('hwp_creative_pending_title')}</Text>
          <Text style={styles.pendingSubtitle}>{t('hwp_creative_pending_sub')}</Text>
        </View>
        <Pressable style={styles.editBtn} onPress={() => setStatus('draft')}>
          <Ionicons name="create-outline" size={16} color={theme.colors.purple} />
          <Text style={styles.editBtnText}>{t('hwp_creative_edit_resubmit')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.instruction}>{instruction}</Text>
      {mediaType === 'text' ? (
        <>
          <TextInput
            style={styles.creativeInput}
            placeholder={t('hwp_creative_placeholder')}
            placeholderTextColor={theme.colors.textLight}
            value={text}
            onChangeText={setText}
            multiline
          />
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.attachedImage} />
          ) : (
            <Pressable style={styles.attachBtn} onPress={pickImage}>
              <Ionicons name="image-outline" size={18} color={theme.colors.purple} />
              <Text style={styles.attachBtnText}>{t('hwp_creative_attach_image')}</Text>
            </Pressable>
          )}
        </>
      ) : (
        <View style={styles.pronounceArea}>
          <Pressable style={[styles.micBtn, isRecording && styles.micBtnActive]} onPress={toggleRecording}>
            <Ionicons name={isRecording ? 'stop' : 'mic'} size={30} color="#fff" />
          </Pressable>
          {recorded && (
            <View style={styles.recordedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
              <Text style={styles.recordedText}>{t('hwp_creative_voice_ready')}</Text>
            </View>
          )}
        </View>
      )}
      <Pressable
        style={[styles.continueBtn, (!canSubmit || submitting) && styles.continueBtnDisabled]}
        disabled={!canSubmit || submitting}
        onPress={submit}>
        <Text style={styles.continueBtnText}>{submitting ? t('hwp_creative_sending') : t('hwp_creative_send')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.textMuted },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: theme.fonts.bold, fontSize: 16, color: theme.colors.text },
  stepContent: { flex: 1, padding: 20 },
  instruction: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.textMuted, marginBottom: 16 },
  sentenceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 22,
    alignItems: 'center',
    marginBottom: 20,
    gap: 4,
    ...theme.shadow.card,
  },
  sentence: { fontFamily: theme.fonts.semiBold, fontSize: 17, color: theme.colors.text, textAlign: 'center', lineHeight: 24 },
  sentenceTranslation: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, marginTop: 4, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: {
    minWidth: '47%',
    flexGrow: 1,
    paddingVertical: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadow.card,
  },
  mcOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadow.card,
  },
  optionCorrect: { borderColor: theme.colors.success, backgroundColor: theme.colors.successBg },
  optionWrong: { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerBg },
  optionText: { fontFamily: theme.fonts.semiBold, fontSize: 15, color: theme.colors.text },
  continueBtn: {
    marginTop: 20,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: { fontFamily: theme.fonts.bold, fontSize: 15, color: '#fff' },

  matchColumns: { flexDirection: 'row', gap: 14 },
  matchColumn: { flex: 1, gap: 10 },
  matchTile: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadow.card,
  },
  matchTileSelected: { borderColor: theme.colors.purple },
  matchTileDone: { borderColor: theme.colors.success, backgroundColor: theme.colors.successBg, opacity: 0.6 },
  matchTileWrong: { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerBg },
  matchTileText: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text, textAlign: 'center' },
  matchProgress: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 16 },

  builtSentenceBox: {
    minHeight: 50,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.purple,
    justifyContent: 'center',
    marginBottom: 16,
  },
  builtSentenceText: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text },
  wordChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    ...theme.shadow.card,
  },
  wordChipUsed: { opacity: 0.25 },
  wordChipText: { fontFamily: theme.fonts.semiBold, fontSize: 14, color: theme.colors.text },
  feedbackText: { fontFamily: theme.fonts.semiBold, fontSize: 15, textAlign: 'center' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 10 },
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
  scoreBadge: { alignItems: 'center', gap: 2 },
  scoreBadgeText: { fontFamily: theme.fonts.extraBold, fontSize: 26, color: theme.colors.purple },
  scoreBadgeLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.textMuted },

  roleplayIntro: {
    fontFamily: theme.fonts.regular,
    fontSize: 12,
    color: theme.colors.textMuted,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  roleplayDoneBtn: {
    margin: 16,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },

  creativeInput: {
    minHeight: 140,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 16,
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    color: theme.colors.text,
    textAlignVertical: 'top',
    ...theme.shadow.card,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.purpleLight,
  },
  attachBtnText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple },
  attachedImage: { width: '100%', height: 180, borderRadius: theme.radius.md, marginTop: 14 },

  pendingCard: { alignItems: 'center', gap: 8, paddingVertical: 40, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, ...theme.shadow.card },
  pendingTitle: { fontFamily: theme.fonts.bold, fontSize: 17, color: theme.colors.text },
  pendingSubtitle: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 24 },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingVertical: 12 },
  editBtnText: { fontFamily: theme.fonts.semiBold, fontSize: 13, color: theme.colors.purple },

  gradedCard: { alignItems: 'center', gap: 8, paddingVertical: 40, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, ...theme.shadow.card },
  gradedScore: { fontFamily: theme.fonts.extraBold, fontSize: 26, color: theme.colors.success },
  gradedFeedback: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 24 },

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
