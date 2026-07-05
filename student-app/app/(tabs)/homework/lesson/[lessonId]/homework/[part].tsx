import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatThreadView } from '@/components/chat/ChatThreadView';
import { theme } from '@/constants/theme';
import { ChatMessage } from '@/data/mock';
import { getLessonContent, HomeworkPart, MatchPair, MultipleChoiceQ, SentenceBuildQ } from '@/data/lessonContent';
import { markHomeworkPartDone } from '@/services/lessonProgressStore';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function HomeworkPartScreen() {
  const { lessonId, part: partId, day } = useLocalSearchParams<{ lessonId: string; part: string; day?: string }>();
  const dayIndex = day === 'speaking' ? 1 : 0;
  const [content] = useState(() => getLessonContent(String(lessonId), dayIndex));
  const part = content.homeworkParts.find((p) => p.id === partId) as HomeworkPart | undefined;

  const complete = () => markHomeworkPartDone(String(lessonId), String(partId));

  if (!part) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Vazifa topilmadi</Text>
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

      {part.kind === 'matching' && <MatchingPart pairs={part.pairs} onDone={complete} />}
      {part.kind === 'fillBlank' && <FillBlankPart blanks={part.blanks} onDone={complete} />}
      {part.kind === 'multipleChoice' && <MultipleChoicePart questions={part.questions} onDone={complete} />}
      {part.kind === 'sentenceBuild' && <SentenceBuildPart items={part.items} onDone={complete} />}
      {part.kind === 'record' && <RecordPart prompts={part.prompts} onDone={complete} />}
      {part.kind === 'pronunciation' && <PronunciationPart prompts={part.prompts} onDone={complete} />}
      {part.kind === 'roleplay' && <RoleplayPart scenario={part.scenario} onDone={complete} />}
      {part.kind === 'creative' && <CreativePart instruction={part.instruction} mediaType={part.mediaType} onDone={complete} />}
    </SafeAreaView>
  );
}

function DoneScreen({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <View style={styles.resultCenter}>
      <Text style={styles.resultEmoji}>{emoji}</Text>
      <Text style={styles.resultTitle}>{title}</Text>
      <Text style={styles.resultSubtitle}>{subtitle}</Text>
      <Pressable style={styles.resultBtn} onPress={() => router.back()}>
        <Text style={styles.resultBtnText}>Orqaga qaytish</Text>
      </Pressable>
    </View>
  );
}

// ─── PART A (grammar) — Matching ────────────────────────────────────────────
function MatchingPart({ pairs, onDone }: { pairs: MatchPair[]; onDone: () => void }) {
  const rightItems = useMemo(() => shuffle(pairs.map((p) => ({ id: p.id, label: p.right }))), [pairs]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState<{ left: string; right: string } | null>(null);
  const [finished, setFinished] = useState(false);

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
      if (next.size === pairs.length) {
        onDone();
        setTimeout(() => setFinished(true), 500);
      }
    } else {
      setWrongFlash({ left: selectedLeft, right: id });
      setTimeout(() => {
        setWrongFlash(null);
        setSelectedLeft(null);
      }, 500);
    }
  };

  if (finished) return <DoneScreen emoji="✅" title="Ajoyib!" subtitle={`${pairs.length} ta juftlik moslashtirildi`} />;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.instruction}>So'zlarni tarjimasi bilan moslashtiring</Text>
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
        {matched.size} / {pairs.length} juftlik topildi
      </Text>
    </View>
  );
}

// ─── PART B (grammar) — Fill in the blank ───────────────────────────────────
function FillBlankPart({ blanks, onDone }: { blanks: { id: string; sentence: string; answer: string; options: string[] }[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const current = blanks[index];
  const answered = selected !== null;
  const isCorrect = selected === current?.answer;

  const next = () => {
    if (index + 1 >= blanks.length) {
      onDone();
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setSelected(null);
  };

  if (finished) return <DoneScreen emoji="✍️" title="Tayyor!" subtitle={`${blanks.length} ta gap to'ldirildi`} />;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.instruction}>
        Bo'sh joyga mos so'zni tanlang ({index + 1}/{blanks.length})
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
          <Text style={styles.continueBtnText}>Keyingi</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── PART C (grammar) — Multiple choice ─────────────────────────────────────
function MultipleChoicePart({ questions, onDone }: { questions: MultipleChoiceQ[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const current = questions[index];
  const answered = selected !== null;
  const isCorrect = selected === current?.correctIndex;

  const next = () => {
    if (index + 1 >= questions.length) {
      onDone();
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setSelected(null);
  };

  if (finished) return <DoneScreen emoji="🎯" title="Zo'r natija!" subtitle={`${questions.length} ta savol yakunlandi`} />;

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
          <Text style={styles.continueBtnText}>Keyingi</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── PART D (grammar) — Sentence building ───────────────────────────────────
function SentenceBuildPart({ items, onDone }: { items: SentenceBuildQ[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const current = items[index];

  return (
    <SentenceBuildRound
      key={current.id}
      item={current}
      onNext={() => {
        if (index + 1 >= items.length) {
          onDone();
          setFinished(true);
        } else {
          setIndex(index + 1);
        }
      }}
      finished={finished}
      total={items.length}
    />
  );
}

function SentenceBuildRound({ item, onNext, finished, total }: { item: SentenceBuildQ; onNext: () => void; finished: boolean; total: number }) {
  const words = useMemo(() => shuffle(item.words), [item]);
  const [used, setUsed] = useState<boolean[]>(() => words.map(() => false));
  const [built, setBuilt] = useState<number[]>([]);

  if (finished) return <DoneScreen emoji="🧩" title="Ajoyib!" subtitle={`${total} ta gap tuzildi`} />;

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
      <Text style={styles.instruction}>Gapni to'g'ri tartibda tuzing</Text>
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
            {isCorrect ? "To'g'ri!" : `To'g'ri javob: ${item.answer.join(' ')}`}
          </Text>
          <Pressable style={styles.continueBtn} onPress={onNext}>
            <Text style={styles.continueBtnText}>Keyingi</Text>
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

// ─── PART A (speaking) — Record yourself ────────────────────────────────────
function RecordPart({ prompts, onDone }: { prompts: { id: string; sentence: string; translation: string }[]; onDone: () => void }) {
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
    if (index + 1 >= prompts.length) {
      onDone();
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setRecorded(false);
  };

  if (finished) return <DoneScreen emoji="🎙️" title="Barakalla!" subtitle={`${prompts.length} ta savolga ovozli javob yozildi`} />;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.instruction}>
        Savolga ovozli javob bering ({index + 1}/{prompts.length})
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
            <Text style={styles.recordedText}>Javob yozib olindi</Text>
          </View>
        )}
      </View>
      {recorded && (
        <Pressable style={styles.continueBtn} onPress={next}>
          <Text style={styles.continueBtnText}>Keyingi</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── PART C (speaking) — Pronunciation check ────────────────────────────────
function PronunciationPart({ prompts, onDone }: { prompts: { id: string; sentence: string; translation: string }[]; onDone: () => void }) {
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
    if (index + 1 >= prompts.length) {
      onDone();
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setScore(null);
  };

  if (finished) return <DoneScreen emoji="🌟" title="Tayyor!" subtitle={`${prompts.length} ta jumla talaffuzi tekshirildi`} />;

  return (
    <View style={styles.stepContent}>
      <Text style={styles.instruction}>
        Jumlani o'qing, talaffuzingiz baholanadi ({index + 1}/{prompts.length})
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
            <Text style={styles.scoreBadgeLabel}>{score >= 90 ? "A'lo talaffuz!" : score >= 80 ? 'Yaxshi talaffuz' : "Yana mashq qiling"}</Text>
          </View>
        )}
      </View>
      {score !== null && (
        <Pressable style={styles.continueBtn} onPress={next}>
          <Text style={styles.continueBtnText}>Keyingi</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── PART B (speaking) — AI roleplay ────────────────────────────────────────
function RoleplayPart({ scenario, onDone }: { scenario: { id: string; title: string; intro: string; lines: string[]; closing: string }; onDone: () => void }) {
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
    advanceBot(next);
  };

  const onSendVoice = (uri: string, durationSeconds?: number) => {
    const next: ChatMessage[] = [
      ...messages,
      { id: `me-${Date.now()}`, chatId: scenario.id, from: 'me', type: 'voice', voiceUri: uri, voiceDuration: durationSeconds, time: 'hozir' },
    ];
    setMessages(next);
    advanceBot(next);
  };

  const onSendImage = () => {};

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.roleplayIntro}>{scenario.intro}</Text>
      <ChatThreadView messages={messages} onSendText={onSendText} onSendImage={onSendImage} onSendVoice={onSendVoice} />
      {ended && (
        <Pressable style={styles.roleplayDoneBtn} onPress={() => router.back()}>
          <Text style={styles.continueBtnText}>Suhbat yakunlandi — Orqaga</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Ijodiy vazifa ───────────────────────────────────────────────────────────
type CreativeStatus = 'draft' | 'pending' | 'graded';

function CreativePart({ instruction, mediaType, onDone }: { instruction: string; mediaType: 'text' | 'audio'; onDone: () => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [status, setStatus] = useState<CreativeStatus>('draft');
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);

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

  const submit = () => {
    setStatus('pending');
    onDone();
    setTimeout(() => setStatus('graded'), 4000);
  };

  const canSubmit = mediaType === 'text' ? text.trim().length > 0 : recorded;

  if (status === 'graded') {
    return (
      <View style={styles.stepContent}>
        <View style={styles.gradedCard}>
          <Ionicons name="ribbon-outline" size={40} color={theme.colors.success} />
          <Text style={styles.gradedScore}>92 / 100</Text>
          <Text style={styles.gradedFeedback}>"Juda yaxshi bajarilgan, davom eting!" — o'qituvchi</Text>
        </View>
        <Pressable style={styles.continueBtn} onPress={() => router.back()}>
          <Text style={styles.continueBtnText}>Orqaga qaytish</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={styles.stepContent}>
        <View style={styles.pendingCard}>
          <Ionicons name="time-outline" size={40} color={theme.colors.warning} />
          <Text style={styles.pendingTitle}>Ko'rib chiqilmoqda</Text>
          <Text style={styles.pendingSubtitle}>O'qituvchi vazifangizni tekshirmoqda, natija tez orada chiqadi.</Text>
        </View>
        <Pressable style={styles.editBtn} onPress={() => setStatus('draft')}>
          <Ionicons name="create-outline" size={16} color={theme.colors.purple} />
          <Text style={styles.editBtnText}>Tahrirlash va qayta yuborish</Text>
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
            placeholder="Matningizni shu yerga yozing..."
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
              <Text style={styles.attachBtnText}>Rasm biriktirish</Text>
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
              <Text style={styles.recordedText}>Ovozli xabar tayyor</Text>
            </View>
          )}
        </View>
      )}
      <Pressable style={[styles.continueBtn, !canSubmit && styles.continueBtnDisabled]} disabled={!canSubmit} onPress={submit}>
        <Text style={styles.continueBtnText}>Yuborish</Text>
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
