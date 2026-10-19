/**
 * v2 Tez tekshiruv (dizayn: 77 · Tez tekshiruv (1-dialog)).
 *
 * Audio dialog tugagach — tinglab tushunish savollari. Savollar shu
 * dialogning o'z matnidan tuziladi (buildQuickCheck): oldingi replika —
 * kontekst, keyingisi — to'g'ri javob, noto'g'ri variantlar — darsdagi
 * boshqa replikalar. "Tinglash" javob replikasini ovoz bilan o'qiydi
 * (replikalar alohida audio bo'lib serverda yo'q — expo-speech).
 * ?d=<raqam> — qaysi dialog (0 dan). Natija serverga yuborilmaydi.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeInUp } from '@/components/v2/motion';
import { playSfx } from '@/services/sfx';
import { praiseAnswer, resetPraiseRun, stopVoice } from '@/services/voicePraise';

import {
  buildQuickCheck,
  getAudioTracks,
  speakerColor,
  speakersOf,
  trackLines,
  type DialogLine,
} from '@/components/v2/lessons/data';
import { ArrowRight, CheckAlt, CloseIcon, SpeakerOutlineIcon } from '@/components/v2/lessons/icons';
import { BottomBar, Center, Column, HeaderButton } from '@/components/v2/lessons/parts';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { fetchMobileContent, type MobileContent } from '@/services/contentApi';
import { stripRichText } from '@/services/richText';

const plainLines = (ls: DialogLine[]) => ls.map((l) => ({ ...l, ru: stripRichText(l.ru), uz: stripRichText(l.uz) }));

export default function QuickCheckScreen() {
  const insets = useSafeAreaInsets();
  const { lessonId, d } = useLocalSearchParams<{ lessonId: string; d?: string }>();
  const id = String(lessonId);
  const trackIdx = Math.max(0, Number(d) || 0);
  const [mc, setMc] = useState<MobileContent | null>(null);
  const [error, setError] = useState(false);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMobileContent()
      .then((x) => !cancelled && setMc(x))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const tracks = useMemo(() => (mc ? getAudioTracks(mc, id) : []), [mc, id]);
  const track = tracks[trackIdx];
  // Test variantlari oddiy matn bilan solishtiriladi va o'qiladi — belgilash olib tashlanadi.
  const lines = useMemo(() => (mc && track ? plainLines(trackLines(mc, track)) : []), [mc, track]);
  const pool = useMemo(() => (mc ? tracks.filter((_, k) => k !== trackIdx).flatMap((t) => plainLines(trackLines(mc, t))) : []), [mc, tracks, trackIdx]);
  const questions = useMemo(() => buildQuickCheck(lines, pool), [lines, pool]);
  const speakers = speakersOf(lines);
  const q = questions[qi];
  const answered = picked !== null;
  const right = answered && picked === q?.correct;

  useEffect(() => {
    resetPraiseRun();
  }, [trackIdx]);

  const listen = () => {
    if (!q) return;
    stopVoice();
    Speech.stop();
    Speech.speak(q.answer.ru, { language: 'ru-RU', rate: 0.9 });
  };
  const next = () => {
    if (qi + 1 < questions.length) {
      setQi(qi + 1);
      setPicked(null);
    } else {
      router.replace(`${R.audioDialog(id)}?d=${trackIdx}` as Href);
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
      <HeaderButton kind="close" label="Yopish" fallback={R.lesson(id)} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.headRow}>
          <Text style={styles.headText}>Tez tekshiruv · {trackIdx + 1}-dialog</Text>
          <Text style={styles.headText}>{questions.length ? qi + 1 : 0} / {questions.length}</Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`Savol ${questions.length ? qi + 1 : 0} / ${questions.length}`}
          accessibilityValue={{ min: 0, max: questions.length, now: questions.length ? qi + 1 : 0 }}
          style={{ flexDirection: 'row', gap: 4 }}
        >
          {(questions.length ? questions : [null]).map((_, k) => (
            <View key={k} style={[styles.seg, { backgroundColor: !questions.length ? '#E2E6EE' : k < qi ? '#087A4A' : k === qi ? '#2F5BFF' : '#E2E6EE' }]} />
          ))}
        </View>
      </View>
    </View>
  );

  if (!q) {
    return (
      <View style={styles.screen}>
        <Column>
          {header}
          <Center>
            <Text style={styles.muted}>
              {error ? 'Savollarni yuklab boʻlmadi.' : mc ? 'Bu dialog uchun savol yoʻq.' : 'Yuklanmoqda…'}
            </Text>
          </Center>
        </Column>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Column>
        {header}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <Image source={designImages.c04932e65803a7f5c40ff5868fd21516} style={{ width: 64, height: 64 }} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View style={styles.introTop}>
                <Text style={styles.over}>Tinglab tushunish</Text>
              </View>
              <Text style={styles.introSub}>Tinglang va toʻgʻri javobni tanlang</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.context}>
              <View style={[styles.avatar, { backgroundColor: speakerColor(speakers, q.context.speaker) }]} accessibilityRole="image" accessibilityLabel={q.context.speaker}>
                <Text style={styles.avatarText}>{q.context.speaker.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.contextText}>{q.context.ru}</Text>
            </View>
            <View style={styles.qRow}>
              <Text accessibilityRole="header" style={styles.question}>{q.answer.speaker} nima dedi?</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`${q.answer.speaker} javobini tinglash`} onPress={listen} style={({ pressed }) => [styles.listen, pressed && { backgroundColor: '#1E3FD1' }]}>
                <SpeakerOutlineIcon />
                <Text style={styles.listenText}>Tinglash</Text>
              </Pressable>
            </View>
            <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
              {q.options.map((opt, k) => {
                const isRight = answered && k === q.correct;
                const isWrong = answered && k === picked && k !== q.correct;
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: picked === k, disabled: answered }}
                    disabled={answered}
                    onPress={() => {
                      setPicked(k);
                      playSfx(k === q.correct ? 'correct' : 'wrong');
                      praiseAnswer(k === q.correct);
                    }}
                    style={[styles.opt, isRight && styles.optRight, isWrong && styles.optWrong]}
                  >
                    <Text style={[styles.optText, isRight && { fontFamily: fonts.bodyHeavy, color: '#075E3A' }, isWrong && { color: '#B42318' }]}>{opt}</Text>
                    {isRight && (
                      <View style={styles.okDot}>
                        <CheckAlt />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {answered && (
            <FadeInUp key={qi}>
            <View accessibilityRole="alert" style={[styles.status, !right && { backgroundColor: '#FDECEC' }]}>
              <View style={[styles.okDot, !right && { backgroundColor: '#B42318' }]}>
                {right ? <CheckAlt /> : <CloseIcon size={14} color="#FFFFFF" strokeWidth={3.2} />}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.statusTitle, !right && { color: '#B42318' }]}>{right ? 'Toʻgʻri!' : 'Notoʻgʻri'}</Text>
                <Text style={[styles.statusBody, !right && { color: '#B42318' }]}>
                  «{q.answer.ru.replace(/[.!?…]+$/, '')}»{q.answer.uz ? ` — ${q.answer.uz}` : ''}
                </Text>
              </View>
            </View>
            </FadeInUp>
          )}

          {answered && (
            <View accessibilityLabel="Audio matni" style={styles.script}>
              <Text style={styles.scriptOver}>Audio matni</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <View style={[styles.avatarSm, { backgroundColor: speakerColor(speakers, q.answer.speaker) }]} accessibilityRole="image" accessibilityLabel={q.answer.speaker}>
                  <Text style={styles.avatarText}>{q.answer.speaker.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={styles.scriptRu}>«{q.answer.ru}»</Text>
                  {!!q.answer.uz && <Text style={styles.scriptUz}>{q.answer.uz}</Text>}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
        <BottomBar>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !answered }}
            disabled={!answered}
            onPress={next}
            style={({ pressed }) => [styles.cta, !answered && { opacity: 0.5 }, pressed && { backgroundColor: '#1E3FD1' }]}
          >
            <Text style={styles.ctaText}>Davom etish</Text>
            <ArrowRight strokeWidth={2.6} />
          </Pressable>
        </BottomBar>
      </Column>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between' },
  headText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  seg: { flex: 1, height: 8, borderRadius: 4 },
  muted: { fontFamily: fonts.body, fontSize: 14, color: '#4A5468', textAlign: 'center' },
  content: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 12, gap: 14 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  introTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  over: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: '#1E3FD1', fontWeight: 'normal' },
  introSub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 18.9, color: '#4A5468', fontWeight: 'normal' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, gap: 12 },
  context: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F4F6FA', borderRadius: 14, paddingVertical: 8, paddingRight: 10, paddingLeft: 12 },
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarSm: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#FFFFFF', fontWeight: 'normal' },
  contextText: { flex: 1, minWidth: 0, fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19.5, color: '#0B1220', fontWeight: 'normal' },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  question: { flex: 1, fontFamily: fonts.display, fontSize: 24, lineHeight: 27.6, letterSpacing: -0.24, color: '#0B1220', fontWeight: 'normal' },
  listen: { height: 44, paddingLeft: 10, paddingRight: 14, borderRadius: 22, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  listenText: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#FFFFFF', fontWeight: 'normal' },
  opt: { minHeight: 56, borderRadius: 16, borderWidth: 2, borderColor: '#E4E8F0', backgroundColor: '#FFFFFF', paddingVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  optRight: { borderColor: '#087A4A', backgroundColor: '#E3F7EE' },
  optWrong: { borderColor: '#B42318', backgroundColor: '#FDECEC' },
  optText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: '#4A5468', fontWeight: 'normal' },
  okDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#087A4A', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  status: { backgroundColor: '#E3F7EE', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  statusTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#075E3A', fontWeight: 'normal' },
  statusBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19.6, color: '#075E3A', fontWeight: 'normal' },
  script: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, gap: 6 },
  scriptOver: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 0.66, textTransform: 'uppercase', color: '#4A5468', fontWeight: 'normal' },
  scriptRu: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19.5, color: '#0B1220', fontWeight: 'normal' },
  scriptUz: { fontFamily: fonts.body, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 5px 0 #1E3FD1' } as object,
  ctaText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#FFFFFF', fontWeight: 'normal' },
});
