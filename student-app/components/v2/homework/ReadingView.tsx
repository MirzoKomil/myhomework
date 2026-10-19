/**
 * O'qish (dizayn: Reading). Haqiqiy tur — eski ReadingPart: ruscha matn
 * (paragraf) va alohida gaplar o'zbekchaga tarjima qilinadi, natija ustozga
 * boradi (creativeSubmissionApi, 'reading' kaliti). Dizayndagi tuzilma
 * saqlangan: sarlavha + tinglash tugmasi, matn, kulrang "SAVOL n / N"
 * kartasi, pastda "Oldingi" / "Keyingi savol". Dizayndagi variantli savol
 * o'rnida — tarjima maydoni, chunki bu turda savol-variant ma'lumoti yo'q.
 */
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/constants/v2/tokens';
import type { ReadingSentence } from '@/data/lessonContent';
import { addCoins } from '@/services/coinsStore';
import { fetchCreativeSubmission, submissionKey, submitCreativeSubmission } from '@/services/creativeSubmissionApi';
import { fetchMobileContent } from '@/services/contentApi';
import { addLightning } from '@/services/lightningStore';
import { markHomeworkPartDone } from '@/services/lessonProgressStore';

import { SpeakerIcon } from './icons';
import { CloseButton, Txt } from './ui';

type Status = 'checking' | 'draft' | 'pending' | 'graded';

type Props = {
  lessonId: string;
  partId: string;
  title: string;
  overline: string;
  paragraph: { id: string; russianText: string };
  sentences: ReadingSentence[];
  onClose: () => void;
};

export function ReadingView({ lessonId, partId, title, overline, paragraph, sentences, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const key = submissionKey(lessonId, 'reading');
  const [status, setStatus] = useState<Status>('checking');
  // 0 — paragraf tarjimasi, 1..N — alohida gaplar.
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => ['', ...sentences.map(() => '')]);
  const [speaking, setSpeaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [graded, setGraded] = useState<{ score: number | null; feedback: string | null } | null>(null);
  const total = 1 + sentences.length;

  const done = () => markHomeworkPartDone(lessonId, partId);

  useEffect(() => {
    let cancelled = false;
    fetchCreativeSubmission(key).then((r) => {
      if (cancelled) return;
      if (r?.status === 'graded') {
        setGraded({ score: r.scorePercent, feedback: r.feedback });
        setStatus('graded');
        void done();
      } else setStatus(r?.status === 'pending' ? 'pending' : 'draft');
    });
    return () => {
      cancelled = true;
      Speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Ustoz qabul qilganini bilish uchun davriy tekshiruv (eski ekrandagidek).
  useEffect(() => {
    if (status !== 'pending') return;
    let cancelled = false;
    const poll = setInterval(async () => {
      const r = await fetchCreativeSubmission(key);
      if (cancelled || r?.status !== 'graded') return;
      setGraded({ score: r.scorePercent, feedback: r.feedback });
      setStatus('graded');
      addLightning(1);
      void done();
    }, 8000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, key]);

  const listenText = step === 0 ? paragraph.russianText : sentences[step - 1]?.russianText ?? '';
  const toggleSpeech = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(listenText, { language: 'ru-RU', onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };

  const submit = async () => {
    setSubmitting(true);
    const mc = await fetchMobileContent().catch(() => null);
    const lessonTitle = mc?.lessons.find((l) => l.id === lessonId)?.name || lessonId;
    await submitCreativeSubmission({
      lessonId: key,
      lessonTitle,
      category: 'reading',
      mediaType: 'text',
      text: JSON.stringify({ paragraphTranslation: answers[0], sentenceTranslations: answers.slice(1) }),
    });
    setSubmitting(false);
    setStatus('pending');
    addCoins(1, lessonId);
  };

  const header = (
    <View style={st.header}>
      <CloseButton bg="#F4F6FA" onPress={onClose} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt f="bodyHeavy" size={12} color="#4A5468" numberOfLines={1}>
          {overline}
        </Txt>
        <Txt f="bodyHeavy" size={16} numberOfLines={1}>
          {title}
        </Txt>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Matnni tinglash" onPress={toggleSpeech} style={({ pressed }) => [st.listen, pressed && { opacity: 0.85 }]}>
        <SpeakerIcon />
      </Pressable>
    </View>
  );

  if (status === 'checking') {
    return (
      <View style={{ flex: 1 }}>
        {header}
        <View style={st.center}>
          <ActivityIndicator color="#2F5BFF" accessibilityLabel="Yuklanmoqda" />
        </View>
      </View>
    );
  }

  if (status !== 'draft') {
    const isGraded = status === 'graded';
    return (
      <View style={{ flex: 1 }}>
        {header}
        <View style={[st.center, { paddingHorizontal: 20 }]}>
          <View style={[st.card, { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 28 }]}>
            <Txt f="display" size={22} color={isGraded ? '#075E3A' : '#0B1220'} style={{ textAlign: 'center' }}>
              {isGraded ? `${graded?.score ?? 100} / 100` : 'Koʻrib chiqilmoqda'}
            </Txt>
            <Txt f="body" size={14} color="#4A5468" lh={20} style={{ textAlign: 'center' }}>
              {isGraded
                ? `«${graded?.feedback || 'Juda yaxshi bajarilgan, davom eting!'}» — oʻqituvchi`
                : 'Oʻqituvchi vazifangizni tekshirmoqda, natija tez orada chiqadi.'}
            </Txt>
          </View>
        </View>
        <View style={[st.footer, { paddingBottom: Math.max(34, insets.bottom + 14) }]}>
          {!isGraded && (
            <Pressable accessibilityRole="button" onPress={() => setStatus('draft')} style={({ pressed }) => [st.btnGhost, pressed && { opacity: 0.85 }]}>
              <Txt f="bodyHeavy" size={16}>
                Tahrirlash
              </Txt>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [st.btnPrimary, pressed && { opacity: 0.85 }]}>
            <Txt f="bodyHeavy" size={16} color="#FFFFFF">
              Vazifaga qaytish
            </Txt>
          </Pressable>
        </View>
      </View>
    );
  }

  const current = answers[step];
  const isLast = step === total - 1;
  const setCurrent = (v: string) => setAnswers((a) => a.map((x, i) => (i === step ? v : x)));

  return (
    <View style={{ flex: 1 }}>
      {header}
      <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Txt f="body" size={16.5} lh={30} lang="ru">
          {paragraph.russianText}
        </Txt>
        <View style={st.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Txt f="bodyHeavy" size={12} color="#4A5468" style={{ letterSpacing: 0.72 }}>
              SAVOL {step + 1} / {total}
            </Txt>
            {current.trim().length > 0 && (
              <Txt f="bodyHeavy" size={12} color="#075E3A" style={st.badge}>
                Tarjima yozildi
              </Txt>
            )}
          </View>
          <Txt f="bodyHeavy" size={16} lang="ru">
            {step === 0 ? 'Matnni oʻzbek tiliga tarjima qiling' : sentences[step - 1].russianText}
          </Txt>
          <TextInput
            value={current}
            onChangeText={setCurrent}
            multiline
            placeholder="Oʻzbekcha tarjimani shu yerga yozing..."
            placeholderTextColor="#5B6478"
            accessibilityLabel="Tarjima"
            style={[st.input, current.trim() ? st.inputFilled : null]}
          />
        </View>
      </ScrollView>
      <View style={[st.footer, { paddingBottom: Math.max(34, insets.bottom + 14) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: step === 0 }}
          disabled={step === 0}
          onPress={() => setStep(step - 1)}
          style={({ pressed }) => [st.btnGhost, pressed && { opacity: 0.85 }]}
        >
          <Txt f="bodyHeavy" size={16}>
            Oldingi
          </Txt>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !current.trim() || submitting }}
          disabled={!current.trim() || submitting}
          onPress={() => (isLast ? submit() : setStep(step + 1))}
          style={({ pressed }) => [st.btnPrimary, (!current.trim() || submitting) && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
        >
          <Txt f="bodyHeavy" size={16} color="#FFFFFF">
            {isLast ? (submitting ? 'Yuborilmoqda...' : 'Yuborish') : 'Keyingi savol'}
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  listen: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  card: { backgroundColor: '#F4F6FA', borderRadius: 22, padding: 14, gap: 8 },
  badge: { backgroundColor: '#E3F7EE', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' },
  input: {
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E4E8F0',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyBold,
    fontWeight: 'normal',
    fontSize: 15,
    color: '#0B1220',
    textAlignVertical: 'top',
  },
  inputFilled: { borderColor: '#087A4A' },
  footer: { paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', gap: 10 },
  btnGhost: { flex: 1, height: 56, borderRadius: 18, borderWidth: 2, borderColor: '#D5DBE7', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { flex: 1, height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
});
