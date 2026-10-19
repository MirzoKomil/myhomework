/**
 * "Dars yopiq" pastki oynasi (dizayn: 78 · Popup · 33-dars yopiq).
 *
 * Darslar yo'lida yopiq dars bosilganda ochiladi. Hamma raqamlar haqiqiy:
 * joriy darsning 5 qadami (lessonSteps), o'rganilgan so'zlar, tinglangan
 * dialoglar, vazifa savollari (homeworkSummary) va jonli dars vaqti (demo-schedule).
 * Darsni yakunlash uchun alohida coin serverda yo'q — "+0 coin".
 */
import { router, type Href } from 'expo-router';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import {
  getAudioTracks,
  homeworkSummary,
  learnedWordIds,
  lessonSteps,
  shortDay,
  useListened,
  useSeenWords,
  whenLabel,
  type CourseData,
  type LessonInfo,
} from '@/components/v2/lessons/data';
import { ArrowRight, CheckAlt, CloseIcon, LockIcon } from '@/components/v2/lessons/icons';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';

export function LessonLockedPopup({
  visible,
  onClose,
  data,
  lesson,
  date,
  activeLiveAt,
}: {
  visible: boolean;
  onClose: () => void;
  data: CourseData | null;
  /** Bosilgan yopiq dars. */
  lesson: LessonInfo | null;
  /** Yopiq darsning jadvaldagi sanasi (bo'lsa). */
  date?: Date;
  /** Joriy (ochiq) jonli darsning vaqti (bo'lsa). */
  activeLiveAt?: Date;
}) {
  const insets = useSafeAreaInsets();
  const active = data ? data.lessons[data.activeIndex] : undefined;
  const listened = useListened(active?.id ?? '');
  const seen = useSeenWords(active?.id ?? '');
  const scores = useHomeworkScores();
  if (!data || !lesson || !active) return null;

  const tracks = getAudioTracks(data.mc, active.id);
  const heard = listened.filter((id) => tracks.some((t) => t.id === id)).length;
  const steps = lessonSteps(active, tracks.length, heard);
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = steps.every((s) => s.done);
  const cur = Math.min(steps.length, doneCount + (allDone ? 0 : 1));
  const curIdx = steps.findIndex((s) => !s.done);
  const words = active.content.vocabulary;
  const learned = learnedWordIds(active.id, words.map((w) => w.id), seen).size;
  const dialogNo = tracks.length ? Math.min(tracks.length, heard + (steps[1].done ? 0 : 1)) : 0;
  const hw = homeworkSummary(active, scores[active.id]);
  const kind = lesson.isVideo ? 'Videodars' : 'Jonli dars';

  const rows = [
    { label: 'Yangi soʻzlar', right: `${learned} / ${words.length}` },
    { label: 'Audio dialoglar', right: `${dialogNo} / ${tracks.length}` },
    { label: active.isVideo ? 'Videodars' : 'Jonli dars', right: !active.isVideo && activeLiveAt ? whenLabel(activeLiveAt) : '' },
    { label: 'Uyga vazifa', right: `${hw.answered} / ${hw.total} savol` },
    { label: 'Darsni yakunlash', right: '+0 coin' },
  ];

  const go = () => {
    onClose();
    router.push(R.lesson(active.id) as Href);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={st.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose} style={[StyleSheet.absoluteFill, st.backdrop]} />
        <View style={st.column}>
          <View accessibilityViewIsModal style={[st.sheet, { paddingBottom: Math.max(29, insets.bottom + 12) }]}>
            <ScrollView bounces={false} contentContainerStyle={st.inner} showsVerticalScrollIndicator={false}>
              <View style={st.grip} />
              <View style={st.closeRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Yopish" onPress={onClose} style={({ pressed }) => [st.close, pressed && st.pressed]}>
                  <CloseIcon />
                </Pressable>
              </View>
              <View style={st.head}>
                <Image source={designImages['68633deaacf537e7e92265a39c0e0949']} style={st.mascot} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                <View style={st.headText}>
                  <View style={st.badge}>
                    <LockIcon size={13} color="#4A5468" strokeWidth={2.4} />
                    <Text style={st.badgeText}>{kind}{date ? ` · ${shortDay(date)}` : ''}</Text>
                  </View>
                  <Text accessibilityRole="header" style={st.title}>{lesson.number}-dars hali yopiq</Text>
                  <Text style={st.sub}>{lesson.name}</Text>
                </View>
              </View>
              <Text style={st.body}>
                Avval {active.number}-darsni yakunlang: siz <Text style={st.bodyBold}>{cur} / {steps.length}</Text> qadamdasiz, yana {steps.length - doneCount} ta qadam qoldi.
              </Text>
              <View accessibilityLabel={`${active.number}-dars qadamlari`} style={st.list}>
                {rows.map((r, k) => {
                  const done = steps[k].done;
                  const isCur = k === curIdx;
                  return (
                    <View key={k} style={[st.row, isCur && { backgroundColor: '#E8EEFF' }]}>
                      {done ? (
                        <View style={[st.circle, { backgroundColor: '#087A4A' }]}><CheckAlt /></View>
                      ) : isCur ? (
                        <View style={[st.circle, { backgroundColor: '#2F5BFF' }]}><Text style={[st.num, { color: '#FFFFFF' }]}>{k + 1}</Text></View>
                      ) : (
                        <View style={[st.circle, st.circleTodo]}><Text style={st.num}>{k + 1}</Text></View>
                      )}
                      <Text style={[st.label, done && { color: '#4A5468' }]} numberOfLines={1}>{r.label}</Text>
                      {!!(r.right || isCur) && (
                        <Text style={[st.right, isCur && { color: '#1E3FD1' }]}>{isCur ? (r.right ? `${r.right} · hozir` : 'hozir') : r.right}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
              <Pressable accessibilityRole="link" onPress={go} style={({ pressed }) => [st.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
                <Text style={st.ctaText}>{active.number}-darsni davom ettirish</Text>
                <ArrowRight strokeWidth={2.6} />
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    backgroundColor: 'rgba(11,18,32,0.35)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(6px)' } as object) : null),
  },
  column: { width: '100%', maxWidth: 480, alignSelf: 'center', maxHeight: '100%' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 12,
    paddingHorizontal: 20,
    boxShadow: '0 -12px 40px rgba(0,0,0,.25)',
  } as object,
  inner: { gap: 14 },
  pressed: { opacity: 0.85 },
  grip: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D5DAE4' },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: -10 },
  close: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#EEF1F7', alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: -20 },
  mascot: { width: 92, height: 92, flexShrink: 0 },
  headText: { flex: 1, minWidth: 0, gap: 4 },
  badge: { alignSelf: 'flex-start', height: 26, paddingHorizontal: 9, borderRadius: 13, backgroundColor: '#EEF1F7', flexDirection: 'row', alignItems: 'center', gap: 5 },
  badgeText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#4A5468', fontWeight: 'normal' },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 28.6, letterSpacing: -0.52, color: '#0B1220', fontWeight: 'normal' },
  sub: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 18.2, color: '#4A5468', fontWeight: 'normal' },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21.75, color: '#4A5468', fontWeight: 'normal' },
  bodyBold: { fontFamily: fonts.bodyHeavy, color: '#0B1220' },
  list: { padding: 6, backgroundColor: '#F4F6FA', borderRadius: 18, gap: 2 },
  row: { borderRadius: 12, minHeight: 48, paddingVertical: 4, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  circle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  circleTodo: { borderWidth: 2, borderColor: '#C9D0DC' },
  num: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  label: { flex: 1, minWidth: 0, fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', fontWeight: 'normal' },
  right: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#4A5468', flexShrink: 0, fontWeight: 'normal' },
  cta: {
    height: 56,
    borderRadius: 18,
    backgroundColor: '#2F5BFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 5px 0 #1E3FD1',
    marginBottom: 5,
  } as object,
  ctaText: { fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#FFFFFF', fontWeight: 'normal' },
});
