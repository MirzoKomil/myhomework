/**
 * Dizaynda alohida artboard'i yo'q turlar: ovozli javob (record), talaffuz
 * (pronunciation), AI suhbat (roleplay) va ijodiy vazifa (creative).
 * Mantiq eski homework/[part].tsx'dagi RecordPart / PronunciationPart /
 * RoleplayPart / CreativePart bilan bir xil; ko'rinish — Exercise
 * artboard'ining sarlavhasi, kartasi va tugmalari.
 */
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { ChatThreadView } from '@/components/chat/ChatThreadView';
import { RichText } from '@/components/RichText';
import { fonts } from '@/constants/v2/tokens';
import type { ChatMessage } from '@/data/mock';
import type { RoleplayScenario, SpeakingPrompt } from '@/data/lessonContent';
import { addCoins } from '@/services/coinsStore';
import { fetchCreativeSubmission, submitCreativeSubmission } from '@/services/creativeSubmissionApi';
import { fetchMobileContent } from '@/services/contentApi';
import { addLightning } from '@/services/lightningStore';

import { LabelHeader, Txt, webShadow } from './ui';

type Base = { lessonId: string; label: string; onDone: () => void; onClose: () => void };

const MicIcon = ({ stop }: { stop: boolean }) => (
  <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    {stop ? (
      <Rect x="7" y="7" width="10" height="10" rx="2" fill="#FFFFFF" />
    ) : (
      <>
        <Rect x="9" y="3" width="6" height="11" rx="3" />
        <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </>
    )}
  </Svg>
);

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [st.primary, webShadow('0 5px 0 #1E3FD1'), disabled && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
    >
      <Txt f="bodyHeavy" size={17} color="#FFFFFF">
        {label}
      </Txt>
    </Pressable>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(34, insets.bottom + 14) }}>{children}</View>;
}

function useRecorderToggle() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const toggle = async (): Promise<'started' | 'stopped' | 'denied'> => {
    if (recording) {
      setRecording(false);
      await recorder.stop();
      return 'stopped';
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return 'denied';
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
    return 'started';
  };
  return { recorder, recording, toggle };
}

/** Ovozli javob va talaffuz — gap kartasi + mikrofon. */
export function RecordView({ prompts, scored, ...b }: Base & { prompts: SpeakingPrompt[]; scored: boolean }) {
  const { recording, toggle } = useRecorderToggle();
  const [index, setIndex] = useState(0);
  const [recorded, setRecorded] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const cur = prompts[index];

  const press = async () => {
    const r = await toggle();
    if (r !== 'stopped') return;
    setRecorded(true);
    // Eski ekrandagidek: talaffuz bahosi taxminiy (serverda tahlil yo'q).
    if (scored) setScore(78 + Math.floor(Math.random() * 20));
  };

  const next = () => {
    if (!scored || (score ?? 0) >= 80) {
      addCoins(1, b.lessonId);
      addLightning(1);
    }
    if (index + 1 >= prompts.length) {
      b.onDone();
      b.onClose();
      return;
    }
    setIndex(index + 1);
    setRecorded(false);
    setScore(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <LabelHeader label={b.label} current={index + 1} total={prompts.length} color="#FF7A1A" onClose={b.onClose} />
      <ScrollView contentContainerStyle={st.body}>
        <Txt f="bodyBold" size={15} color="#4A5468">
          {scored ? 'Gapni ovoz chiqarib ayting' : 'Savolga ovozli javob bering'}
        </Txt>
        <View style={st.card}>
          <Txt f="bodyHeavy" size={22} lh={29.7} lang="ru" style={{ textAlign: 'center' }}>
            {cur.sentence}
          </Txt>
          <Txt f="body" size={14} color="#4A5468" style={{ textAlign: 'center' }}>
            {cur.translation}
          </Txt>
        </View>
        <View style={{ alignItems: 'center', gap: 12, marginTop: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Toʻxtatish' : 'Yozib olish'}
            onPress={press}
            style={[st.mic, { backgroundColor: recording ? '#D92D20' : '#2F5BFF' }]}
          >
            <MicIcon stop={recording} />
          </Pressable>
          {score !== null ? (
            <Txt f="display" size={26} color="#5A2FD6">
              {score}%
            </Txt>
          ) : recorded ? (
            <Txt f="bodyHeavy" size={14} color="#075E3A">
              Yozib olindi
            </Txt>
          ) : null}
        </View>
      </ScrollView>
      {recorded && (
        <Footer>
          <PrimaryButton label="Davom etish" onPress={next} />
        </Footer>
      )}
    </View>
  );
}

/** AI suhbat — eski ChatThreadView qayta ishlatiladi. */
export function RoleplayView({ scenario, ...b }: Base & { scenario: RoleplayScenario }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'intro', chatId: scenario.id, from: 'them', type: 'text', text: scenario.lines[0], time: 'hozir' }]);
  const [line, setLine] = useState(1);
  const [ended, setEnded] = useState(false);

  const advance = (history: ChatMessage[]) => {
    setTimeout(() => {
      if (line < scenario.lines.length) {
        setMessages([...history, { id: `bot-${line}`, chatId: scenario.id, from: 'them', type: 'text', text: scenario.lines[line], time: 'hozir' }]);
        setLine((i) => i + 1);
      } else if (!ended) {
        setMessages([...history, { id: 'closing', chatId: scenario.id, from: 'them', type: 'text', text: scenario.closing, time: 'hozir' }]);
        setEnded(true);
        b.onDone();
      }
    }, 700);
  };
  const send = (m: ChatMessage) => {
    const next = [...messages, m];
    setMessages(next);
    addCoins(1, b.lessonId);
    addLightning(1);
    advance(next);
  };

  return (
    <View style={{ flex: 1 }}>
      <LabelHeader label={b.label} current={Math.min(line, scenario.lines.length)} total={scenario.lines.length} color="#FF7A1A" onClose={b.onClose} />
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Txt f="body" size={13} color="#4A5468">
          <RichText inline style={{ fontFamily: fonts.body }} text={scenario.intro} />
        </Txt>
      </View>
      <ChatThreadView
        messages={messages}
        onSendText={(text) => send({ id: `me-${Date.now()}`, chatId: scenario.id, from: 'me', type: 'text', text, time: 'hozir' })}
        onSendImage={() => {}}
        onSendVoice={(uri, d) => send({ id: `me-${Date.now()}`, chatId: scenario.id, from: 'me', type: 'voice', voiceUri: uri, voiceDuration: d, time: 'hozir' })}
      />
      {ended && (
        <Footer>
          <PrimaryButton label="Vazifaga qaytish" onPress={b.onClose} />
        </Footer>
      )}
    </View>
  );
}

/** Ijodiy vazifa — ustozga yuboriladi (pending → graded). */
export function CreativeView({ instruction, mediaType, category, ...b }: Base & { instruction: string; mediaType: 'text' | 'audio'; category: 'video' | 'speaking' }) {
  const { recorder, recording, toggle } = useRecorderToggle();
  const [status, setStatus] = useState<'checking' | 'draft' | 'pending' | 'graded'>('checking');
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [recorded, setRecorded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [graded, setGraded] = useState<{ score: number | null; feedback: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCreativeSubmission(b.lessonId).then((r) => {
      if (cancelled) return;
      if (r?.status === 'graded') {
        setGraded({ score: r.scorePercent, feedback: r.feedback });
        setStatus('graded');
        b.onDone();
      } else setStatus(r?.status === 'pending' ? 'pending' : 'draft');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.lessonId]);

  useEffect(() => {
    if (status !== 'pending') return;
    let cancelled = false;
    const poll = setInterval(async () => {
      const r = await fetchCreativeSubmission(b.lessonId);
      if (cancelled || r?.status !== 'graded') return;
      setGraded({ score: r.scorePercent, feedback: r.feedback });
      setStatus('graded');
      addLightning(1);
      b.onDone();
    }, 8000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, b.lessonId]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled && r.assets?.[0]) setImageUri(r.assets[0].uri);
  };

  const submit = async () => {
    setSubmitting(true);
    const mc = await fetchMobileContent().catch(() => null);
    await submitCreativeSubmission({
      lessonId: b.lessonId,
      lessonTitle: mc?.lessons.find((l) => l.id === b.lessonId)?.name || b.lessonId,
      category,
      mediaType,
      text: mediaType === 'text' ? text : '',
      imageUri: mediaType === 'text' ? imageUri : null,
      audioUri: mediaType === 'audio' ? recorder.uri : null,
    });
    setSubmitting(false);
    setStatus('pending');
    addCoins(1, b.lessonId);
  };

  const canSubmit = mediaType === 'text' ? text.trim().length > 0 : recorded;

  return (
    <View style={{ flex: 1 }}>
      <LabelHeader label={b.label} current={status === 'graded' ? 1 : 0} total={1} color="#F5B70A" onClose={b.onClose} />
      {status === 'checking' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#2F5BFF" accessibilityLabel="Yuklanmoqda" />
        </View>
      ) : status !== 'draft' ? (
        <>
          <View style={[st.body, { flex: 1, justifyContent: 'center' }]}>
            <View style={st.card}>
              <Txt f="display" size={22} color={status === 'graded' ? '#075E3A' : '#0B1220'} style={{ textAlign: 'center' }}>
                {status === 'graded' ? `${graded?.score ?? 100} / 100` : 'Koʻrib chiqilmoqda'}
              </Txt>
              <Txt f="body" size={14} color="#4A5468" lh={20} style={{ textAlign: 'center' }}>
                {status === 'graded'
                  ? `«${graded?.feedback || 'Juda yaxshi bajarilgan, davom eting!'}» — oʻqituvchi`
                  : 'Oʻqituvchi vazifangizni tekshirmoqda, natija tez orada chiqadi.'}
              </Txt>
            </View>
          </View>
          <Footer>
            <PrimaryButton label={status === 'graded' ? 'Vazifaga qaytish' : 'Tahrirlash va qayta yuborish'} onPress={status === 'graded' ? b.onClose : () => setStatus('draft')} />
          </Footer>
        </>
      ) : (
        <>
          <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
            <Txt f="bodyBold" size={15} color="#4A5468">
              <RichText inline style={{ fontFamily: fonts.bodyBold }} text={instruction} />
            </Txt>
            {mediaType === 'text' ? (
              <>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  multiline
                  placeholder="Matningizni shu yerga yozing..."
                  placeholderTextColor="#5B6478"
                  accessibilityLabel="Javob matni"
                  style={st.input}
                />
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={{ width: '100%', height: 180, borderRadius: 18 }} />
                ) : (
                  <Pressable accessibilityRole="button" onPress={pickImage} style={st.attach}>
                    <Txt f="bodyHeavy" size={14} color="#1E3FD1">
                      Rasm biriktirish
                    </Txt>
                  </Pressable>
                )}
              </>
            ) : (
              <View style={{ alignItems: 'center', gap: 12, marginTop: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={recording ? 'Toʻxtatish' : 'Yozib olish'}
                  onPress={async () => {
                    if ((await toggle()) === 'stopped') setRecorded(true);
                  }}
                  style={[st.mic, { backgroundColor: recording ? '#D92D20' : '#2F5BFF' }]}
                >
                  <MicIcon stop={recording} />
                </Pressable>
                {recorded && (
                  <Txt f="bodyHeavy" size={14} color="#075E3A">
                    Ovozli xabar tayyor
                  </Txt>
                )}
              </View>
            )}
          </ScrollView>
          <Footer>
            <PrimaryButton label={submitting ? 'Yuborilmoqda...' : 'Yuborish'} disabled={!canSubmit || submitting} onPress={submit} />
          </Footer>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  body: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 18, paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  mic: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  primary: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 140,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2E6EE',
    backgroundColor: '#FFFFFF',
    padding: 16,
    fontFamily: fonts.bodyBold,
    fontWeight: 'normal',
    fontSize: 15,
    color: '#0B1220',
    textAlignVertical: 'top',
  },
  attach: { height: 48, borderRadius: 15, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center' },
});
