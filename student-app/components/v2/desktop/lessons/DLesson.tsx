/**
 * Kompyuter: Dars (dizayn: D_Lesson.dc.html).
 *
 * Ma'lumot mobil Dars ekrani bilan bir xil: loadCourseData, qadamlar
 * (lessonSteps), o'rganilgan so'zlar, tinglangan dialoglar, vazifa xulosasi
 * (homeworkSummary), jonli dars vaqti va Telegram havolasi (demo-schedule),
 * dars davomiyligi (to'lov ma'lumotidagi lessonDuration). Kompyuterda
 * qo'shimcha: guruh nomi (jadval mavzusidan) va ustoz ismi (profil), jonli
 * darsgacha qolgan vaqt, birinchi slayd rasmi, darsning so'zlari ro'yxati.
 * Mukofot: mobil hisob (+savollar soni coin/chaqmoq); seriya — joriy seriya + 1.
 * Vazifa muddati serverda yo'q — ko'rsatilmaydi.
 */
import { lessonGoal } from '@/components/v2/home/lessonGoal';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { RichText } from '@/components/RichText';
import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import {
  bookPart,
  bookTrackNo,
  currentStep,
  getAudioTracks,
  homeworkSummary,
  learnedWordIds,
  lessonSteps,
  loadCourseData,
  MONTH_SIZE,
  pad,
  useListened,
  useSeenWords,
  whenLabel,
  type CourseData,
  type Step,
} from '@/components/v2/lessons/data';
// Kartochkalar belgisi — mobil ekrandagi (dizaynda faqat "bajarildi" holati bor).
import { CardsIcon } from '@/components/v2/lessons/icons';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { fetchDemoSchedule, fetchDemoStudentPayments, fetchDemoStudentProfile } from '@/services/contentApi';
import { useLessonProgress } from '@/services/lessonProgressStore';

import { DesktopPage } from '../Shell';
import { useShellInfo } from '../shellData';
import { IArrow, IBolt, ICamera, ICheck, IChevron, ICoin, IFlag, IFlame, IHeadphones, ILock, IPause, IPencil, IPlay, IScreen, ITelegram, T, useCountdown } from './ui';

const MONTH_TITLES: Record<number, string> = { 1: 'Tanishuv', 2: 'Kundalik hayot' };
const go = (h: string) => router.push(h as Href);

type Live = { startsAt: Date | null; link: string; topic: string };

export function DLesson({ id }: { id: string }) {
  const [data, setData] = useState<CourseData | null>(null);
  const [error, setError] = useState(false);
  const [live, setLive] = useState<Live>({ startsAt: null, link: '', topic: '' });
  const [duration, setDuration] = useState<number | null>(null);
  const [teacher, setTeacher] = useState('');
  useLessonProgress(id);
  const listened = useListened(id);
  const seen = useSeenWords(id);
  const scores = useHomeworkScores();
  const shell = useShellInfo();
  // Tor oyna (1024–1279): asosiy ustun ~350px — maskot burchakka kichrayadi.
  const narrow = useWindowDimensions().width < 1280;

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadCourseData().then((d) => !cancelled && setData(d)).catch(() => !cancelled && setError(true));
      fetchDemoSchedule()
        .then((s) => !cancelled && setLive({ startsAt: s.startsAt ? new Date(s.startsAt) : null, link: s.telegramGroupLink, topic: s.topic }))
        .catch(() => {});
      fetchDemoStudentPayments()
        .then((p) => !cancelled && p && setDuration(p.lessonDuration))
        .catch(() => {});
      fetchDemoStudentProfile()
        .then((p) => !cancelled && p && setTeacher(p.mainTeacherName))
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const lesson = data?.lessons.find((l) => l.id === id);
  const isNextLive = !!lesson && !lesson.isVideo && !!data && data.activeIndex === lesson.index && !!live.startsAt;
  const countdown = useCountdown(isNextLive ? live.startsAt : null);

  if (!data || !lesson) {
    return (
      <DesktopPage title="Dars" back={R.path}>
        <T f="body" size={14} color="#4A5468">
          {error || (data && !lesson) ? 'Darsni yuklab boʻlmadi.' : 'Yuklanmoqda…'}
        </T>
      </DesktopPage>
    );
  }

  const tracks = getAudioTracks(data.mc, id);
  const heard = listened.filter((x) => tracks.some((t) => t.id === x)).length;
  const steps = lessonSteps(lesson, tracks.length, heard);
  const cur = currentStep(steps);
  const allDone = steps.every((s) => s.done);
  const doneN = steps.filter((s) => s.done).length;
  const stepNo = Math.min(steps.length, doneN + (allDone ? 0 : 1));
  const kind = lesson.isVideo ? 'Videodars' : 'Jonli dars';
  const whenText = isNextLive ? whenLabel(live.startsAt!) : '';
  const [title, phrase] = (() => {
    const m = lesson.name.match(/^(.*?)\s+[—–-]\s+(.+)$/);
    return m ? [m[1], m[2]] : [lesson.name, ''];
  })();
  const adminKonspekt = lessonGoal(data.mc.lessonContents[id]?.konspekt);
  const hw = homeworkSummary(lesson, scores[id]);
  const words = lesson.content.vocabulary;
  const learned = learnedWordIds(id, words.map((w) => w.id), seen).size;
  const slides = lesson.content.slides;
  const dialogNo = tracks.length ? Math.min(tracks.length, heard + (steps[1].done ? 0 : 1)) : 0;
  const monthNo = Math.floor(lesson.index / MONTH_SIZE) + 1;
  const partNo = (k: number) => tracks[k]?.bookPart ?? bookPart(lesson.index);
  const trackNo = (k: number) => tracks[k]?.trackNo ?? bookTrackNo(data.mc, data.lessons, lesson.index, k);
  const group = (() => {
    const m = /^Speaking Club:\s*(.+)$/.exec(live.topic) ?? /(\S+)\s+guruh/.exec(live.topic);
    return m ? m[1].trim() : '';
  })();
  const liveTime = isNextLive
    ? whenText.startsWith('bugun')
      ? `Bugun ${pad(live.startsAt!.getHours())}:${pad(live.startsAt!.getMinutes())}`
      : capital(whenText)
    : '';
  const liveSub = liveTime
    ? [liveTime, duration ? `${duration} daq` : '', group ? `${group} guruh` : '', teacher].filter(Boolean).join(' · ')
    : lesson.attendanceTaken
      ? 'Qatnashdingiz'
      : 'Ustoz bilan';
  const hwStatus = hw.done ? 'bajarildi' : hw.answered > 0 ? 'davom etmoqda' : 'avtomatik tekshiriladi';
  const hwSub = [hw.letters.length ? hw.letters.join(' + ') : '', `${hw.answered} / ${hw.total}`, hwStatus].filter(Boolean).join(' · ');
  const state = (k: number): 'done' | 'current' | 'todo' => (steps[k].done ? 'done' : k === cur ? 'current' : 'todo');
  const cta = ctaFor(steps[cur], lesson.isVideo, id);
  const curFrac = steps[cur] && !steps[cur].done ? steps[cur].fraction : 0;

  return (
    <DesktopPage
      title={`${lesson.number}-dars · ${kind}`}
      subtitle={`Darslar · ${monthNo}-oy${MONTH_TITLES[monthNo] ? ` · ${MONTH_TITLES[monthNo]}` : ''} · qadam ${stepNo} / ${steps.length}`}
      back={R.path}
      contentStyle={{ paddingBottom: 32 }}
    >
      <View style={s.body}>
        <View style={s.main}>
          <View style={s.hero}>
            <View accessibilityElementsHidden style={s.heroBlob} />
            <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
              <View style={{ gap: 3, paddingRight: narrow ? 90 : 0 }}>
                <T f="display" size={34} lh={35.7} ls={-0.68}>
                  {title}
                </T>
                {!!phrase && (
                  <T size={22} color="#1E3FD1">
                    {phrase}
                  </T>
                )}
              </View>
              {!!adminKonspekt && (
                <View style={s.goal}>
                  <View style={s.goalCheck}>
                    <ICheck size={12} strokeWidth={3.2} />
                  </View>
                  <T f="bodyBold" size={14} style={{ flexShrink: 1 }}>
                    Darsdan keyin: <RichText inline style={{ fontFamily: fonts.bodyHeavy }} text={adminKonspekt} />
                  </T>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Pressable accessibilityRole="link" onPress={cta.onPress} style={({ pressed }) => [s.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
                  <T size={16} color="#FFFFFF" lines={1}>
                    {cta.label}
                  </T>
                  <IArrow size={18} strokeWidth={2.4} />
                </Pressable>
                <View style={{ width: 150, gap: 6, flexShrink: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <T size={13} color="#34405A">
                      Qadam {stepNo} / {steps.length}
                    </T>
                    <T size={13} color="#087A4A">
                      {doneN} ✓
                    </T>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {steps.map((x, k) => (
                      <View key={x.key} style={[s.seg, { backgroundColor: x.done ? '#087A4A' : '#C3D0FF' }]}>
                        {k === cur && curFrac > 0 && <View style={{ width: `${Math.round(curFrac * 100)}%`, height: 6, backgroundColor: '#2F5BFF' }} />}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
            <Image source={designImages.c04932e65803a7f5c40ff5868fd21516} style={narrow ? s.heroImgNarrow : s.heroImg} resizeMode="contain" accessibilityElementsHidden />
          </View>

          <View style={{ gap: 10 }}>
            <T size={18} style={{ marginBottom: 2 }}>
              Dars qadamlari
            </T>
            <StepRow
              n={1}
              state={state(0)}
              iconBg={state(0) === 'done' ? '#E3F7EE' : state(0) === 'current' ? '#2F5BFF' : '#F0EBFF'}
              icon={state(0) === 'done' ? <ICheck color="#087A4A" /> : <CardsIcon color={state(0) === 'current' ? '#FFFFFF' : '#5A2FD6'} />}
              title="Yangi soʻzlar"
              sub={steps[0].done ? `${words.length} / ${words.length} oʻrganildi · bajarildi` : `${learned} / ${words.length} oʻrganildi`}
              action={steps[0].done ? 'Takrorlash' : 'Davom etish'}
              onPress={() => go(R.wordList(id))}
            />
            <View style={[s.step, state(1) === 'current' && s.stepCur, { flexDirection: 'column', alignItems: 'stretch', gap: 12, paddingBottom: 14 }]}>
              <StepInner
                n={2}
                state={state(1)}
                iconBg={state(1) === 'done' ? '#E3F7EE' : state(1) === 'current' ? '#2F5BFF' : '#E8EEFF'}
                icon={state(1) === 'done' ? <ICheck color="#087A4A" /> : <IHeadphones color={state(1) === 'current' ? '#FFFFFF' : '#1E3FD1'} />}
                title="Audio dialoglar"
                sub={
                  state(1) === 'current' && tracks.length
                    ? `${dialogNo}-dialog tinglanmoqda · ${dialogNo} / ${tracks.length} · kitob ${partNo(0)}-qism`
                    : `${heard} / ${tracks.length} tinglandi${steps[1].done && tracks.length ? ' · bajarildi' : ''}`
                }
                action="Davom etish"
                onPress={() => go(R.audioDialog(id))}
              />
              {tracks.length > 0 && (
                <View style={s.tracks}>
                  {tracks.slice(0, 3).map((t, k) => {
                    const on = state(1) === 'current' && k === dialogNo - 1;
                    return (
                      <Pressable
                        key={t.id}
                        accessibilityRole="link"
                        onPress={() => go(`${R.audioDialog(id)}?d=${k}`)}
                        style={[s.track, on ? s.trackOn : null]}
                      >
                        <View style={[s.trackBtn, { backgroundColor: on ? '#2F5BFF' : '#FFFFFF' }]}>{on ? <IPause /> : <IPlay color="#34405A" />}</View>
                        <View style={{ minWidth: 0, flexShrink: 1, gap: 1 }}>
                          <T size={14} lines={1}>
                            {t.title}
                          </T>
                          <T f="bodyBold" size={12} color="#4A5468" lines={1}>
                            {trackNo(k)}-trek{t.duration ? ' · ' : ''}
                            {!!t.duration && <T size={12} color={on ? '#1E3FD1' : '#4A5468'} f={on ? 'bodyHeavy' : 'bodyBold'}>{t.duration}</T>}
                          </T>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
            {lesson.isVideo ? (
              <StepRow
                n={3}
                state={state(2)}
                iconBg={state(2) === 'done' ? '#E3F7EE' : state(2) === 'current' ? '#2F5BFF' : '#FDECEC'}
                icon={state(2) === 'done' ? <ICheck color="#087A4A" /> : <IPlay size={19} color={state(2) === 'current' ? '#FFFFFF' : '#B42318'} />}
                title="Videodars"
                sub={steps[2].done ? 'Koʻrilgan · qayta koʻrish' : 'Video va konspekt'}
                action={steps[2].done ? 'Qayta koʻrish' : 'Koʻrish'}
                onPress={() => go(R.video(id))}
              />
            ) : (
              <View style={[s.step, state(2) === 'current' && s.stepCur]}>
                <Num n={3} state={state(2)} />
                <View style={[s.icon, { backgroundColor: state(2) === 'done' ? '#E3F7EE' : '#FDECEC' }]}>{state(2) === 'done' ? <ICheck color="#087A4A" /> : <ICamera />}</View>
                <View style={s.stepText}>
                  <T size={16}>Jonli dars</T>
                  <T f="body" size={13} color="#4A5468">
                    {liveSub}
                  </T>
                </View>
                <Pressable accessibilityRole="link" accessibilityLabel={`Slaydlar, ${slides.length} ta`} onPress={() => go(R.slides(id))} style={({ pressed }) => [s.slidesBtn, pressed && { opacity: 0.85 }]}>
                  <IScreen />
                  <T size={14}>Slaydlar · {slides.length}</T>
                </Pressable>
                {!!live.link && (
                  <Pressable accessibilityRole="link" accessibilityLabel="Telegram guruhga oʻtish" onPress={() => Linking.openURL(live.link).catch(() => {})} style={({ pressed }) => [s.tgBtn, pressed && { opacity: 0.85 }]}>
                    <ITelegram />
                    <T size={14}>Guruhga</T>
                  </Pressable>
                )}
              </View>
            )}
            <StepRow
              n={4}
              state={state(3)}
              iconBg={state(3) === 'done' ? '#E3F7EE' : state(3) === 'current' ? '#2F5BFF' : '#FFF4D1'}
              icon={state(3) === 'done' ? <ICheck color="#087A4A" /> : <IPencil size={19} color={state(3) === 'current' ? '#FFFFFF' : '#7A5300'} />}
              title="Uyga vazifa"
              sub={hwSub}
              progress={hw.total ? hw.answered / hw.total : 0}
              action={hw.done ? 'Natija' : 'Davom etish'}
              onPress={() => go(R.homework(id))}
            />
            {allDone ? (
              <StepRow
                n={5}
                state="current"
                iconBg="#2F5BFF"
                icon={<IFlag size={19} color="#FFFFFF" strokeWidth={2.2} />}
                title="Darsni yakunlash"
                sub="Hammasi bajarildi"
                action="Yakunlash"
                onPress={() => go(R.complete(id))}
              />
            ) : (
              <View accessibilityLabel="Darsni yakunlash, uyga vazifadan keyin ochiladi" accessibilityState={{ disabled: true }} style={[s.step, { backgroundColor: '#EEF1F7' }]}>
                <View style={[s.num, { backgroundColor: '#E2E6EE' }]}>
                  <T size={12} color="#4A5468">
                    5
                  </T>
                </View>
                <View style={[s.icon, { backgroundColor: '#E2E6EE' }]}>
                  <IFlag size={19} color="#5B6478" strokeWidth={2.2} />
                </View>
                <View style={s.stepText}>
                  <T size={16} color="#4A5468">
                    Darsni yakunlash
                  </T>
                  <T f="body" size={13} color="#4A5468">
                    Uyga vazifadan keyin ochiladi · seriya {shell.streak + 1} kunga chiqadi
                  </T>
                </View>
                <ILock size={18} />
              </View>
            )}
          </View>
        </View>

        <View style={s.aside}>
          {!lesson.isVideo && (
            <View accessibilityLabel="Jonli dars" style={s.liveCard}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 2, paddingHorizontal: 2 }}>
                <View style={{ gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A5F' }} />
                    <T size={12} color="#FF9A9E" ls={0.72} style={{ textTransform: 'uppercase' }}>
                      Jonli dars{live.startsAt ? ` · ${pad(live.startsAt.getHours())}:${pad(live.startsAt.getMinutes())}` : ''}
                    </T>
                  </View>
                  <View accessibilityRole="timer" accessibilityLabel={countdown.label}>
                    <T f="display" size={30} lh={31.5} color="#FFFFFF" style={{ fontVariant: ['tabular-nums'] }}>
                      {countdown.text}
                    </T>
                  </View>
                </View>
                {!!live.link && (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`${group ? `${group} ` : ''}Telegram guruhiga oʻtish`}
                    onPress={() => Linking.openURL(live.link).catch(() => {})}
                    style={({ pressed }) => [s.tgBtn, { borderRadius: 14 }, pressed && { opacity: 0.85 }]}
                  >
                    <ITelegram />
                    <T size={14}>Guruhga</T>
                  </Pressable>
                )}
              </View>
              <Pressable accessibilityRole="link" onPress={() => go(R.slides(id))} style={s.slideThumb}>
                {slides[0]?.imageUrl ? (
                  <Image source={{ uri: slides[0].imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={`${lesson.number}-dars 1-slaydi`} />
                ) : (
                  <View style={{ flex: 1, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                    <T size={16} color="#1E3FD1" style={{ textAlign: 'center' }}>
                      {slides[0]?.title ?? ''}
                    </T>
                  </View>
                )}
                <View style={s.slideChip}>
                  <IScreen size={15} color="#FFFFFF" />
                  <T size={13} color="#FFFFFF">
                    Slaydlar · {slides.length ? 1 : 0} / {slides.length}
                  </T>
                </View>
              </Pressable>
            </View>
          )}

          <View style={s.wordsCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
              <T size={16}>Dars soʻzlari · {words.length}</T>
              <Pressable accessibilityRole="link" onPress={() => go(R.wordList(id))}>
                <T size={14} color="#1E3FD1">
                  Hammasi
                </T>
              </Pressable>
            </View>
            <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false}>
              {words.map((w) => (
                <View key={w.id} style={s.wordRow}>
                  <T size={15} lh={25}>
                    {w.english}
                  </T>
                  <T f="body" size={13} color="#4A5468" style={{ textAlign: 'right', flexShrink: 1 }}>
                    {w.translation}
                  </T>
                </View>
              ))}
            </ScrollView>
          </View>

          <View accessibilityLabel="Dars mukofoti" style={s.reward}>
            <T size={13} color="#4A5468">
              Mukofot
            </T>
            <View style={s.rItem}>
              <ICoin />
              <T size={14} color="#7A5300">
                +{hw.total}
              </T>
            </View>
            <View style={[s.rItem, { gap: 3 }]}>
              <IBolt />
              <T size={14} color="#6A3CF0">
                +{hw.total}
              </T>
            </View>
            <View style={[s.rItem, { gap: 3 }]}>
              <IFlame />
              <T size={14} color="#B34700">
                {shell.streak + 1} kun
              </T>
            </View>
          </View>
        </View>
      </View>
    </DesktopPage>
  );
}

function capital(x: string) {
  return x.charAt(0).toUpperCase() + x.slice(1);
}

function ctaFor(step: Step, isVideo: boolean, id: string): { label: string; onPress: () => void } {
  switch (step.key) {
    case 'vocab':
      return { label: step.fraction > 0 ? 'Soʻzlarni davom ettirish' : 'Soʻzlarni boshlash', onPress: () => go(R.vocab(id)) };
    case 'audio':
      return { label: 'Audio dialogni davom ettirish', onPress: () => go(R.audioDialog(id)) };
    case 'main':
      return isVideo ? { label: 'Videodarsni koʻrish', onPress: () => go(R.video(id)) } : { label: 'Slaydlarni koʻrish', onPress: () => go(R.slides(id)) };
    case 'homework':
      return { label: 'Uyga vazifani davom ettirish', onPress: () => go(R.homework(id)) };
    default:
      return { label: 'Darsni yakunlash', onPress: () => go(R.complete(id)) };
  }
}

function Num({ n, state }: { n: number; state: 'done' | 'current' | 'todo' }) {
  const bg = state === 'done' ? '#E3F7EE' : state === 'current' ? '#2F5BFF' : '#EEF1F7';
  const color = state === 'done' ? '#075E3A' : state === 'current' ? '#FFFFFF' : '#4A5468';
  return (
    <View style={[s.num, { backgroundColor: bg }]}>
      <T size={12} color={color}>
        {n}
      </T>
    </View>
  );
}

function StepInner({
  n,
  state,
  icon,
  iconBg,
  title,
  sub,
  action,
  progress,
  onPress,
}: {
  n: number;
  state: 'done' | 'current' | 'todo';
  icon: ReactNode;
  iconBg: string;
  title: string;
  sub: string;
  action: string;
  progress?: number;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Num n={n} state={state} />
      <View style={[s.icon, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={s.stepText}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <T size={16}>{title}</T>
          {state === 'current' && (
            <View style={s.now}>
              <T size={12} color="#1E3FD1">
                HOZIR
              </T>
            </View>
          )}
        </View>
        <T f="body" size={13} color="#4A5468">
          {sub}
        </T>
      </View>
      {progress !== undefined && (
        <View style={s.hwTrack}>
          <View style={{ width: `${Math.round(progress * 100)}%`, height: 6, borderRadius: 3, backgroundColor: '#F5B70A' }} />
        </View>
      )}
      <T size={14} color="#1E3FD1">
        {action}
      </T>
      <IChevron color={state === 'current' ? '#2F5BFF' : '#5B6478'} />
    </Pressable>
  );
}

function StepRow(p: Parameters<typeof StepInner>[0]) {
  return (
    <View style={[s.step, p.state === 'current' && s.stepCur]}>
      <View style={{ flex: 1 }}>
        <StepInner {...p} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, flexDirection: 'row', gap: 24 },
  main: { flex: 1, minWidth: 0, gap: 22 },
  hero: { position: 'relative', backgroundColor: '#E8EEFF', borderRadius: 28, paddingVertical: 24, paddingHorizontal: 28, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 24 },
  heroBlob: { position: 'absolute', right: -30, top: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: '#DCE5FF' },
  heroImg: { width: 190, height: 176, flexShrink: 0, marginRight: 6 },
  heroImgNarrow: { position: 'absolute', right: 8, top: 8, width: 96, height: 89 },
  goal: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 14 },
  goalCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#087A4A', alignItems: 'center', justifyContent: 'center' },
  cta: { height: 52, paddingHorizontal: 24, borderRadius: 17, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0, boxShadow: '0 5px 0 #1E3FD1' } as object,
  seg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  step: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 12, paddingLeft: 14, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepCur: { boxShadow: '0 0 0 2px #2F5BFF, 0 10px 26px rgba(47,91,255,0.14)' } as object,
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, minWidth: 0, gap: 1 },
  now: { marginLeft: 6, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#E8EEFF' },
  hwTrack: { width: 120, height: 6, borderRadius: 3, backgroundColor: '#EEF1F7', overflow: 'hidden' },
  tracks: { flexDirection: 'row', gap: 8, paddingLeft: 96 },
  track: { flex: 1, minWidth: 0, backgroundColor: '#F4F6FA', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  trackOn: { backgroundColor: '#E8EEFF', boxShadow: 'inset 0 0 0 2px #2F5BFF' } as object,
  trackBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  slidesBtn: { height: 44, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#F4F6FA', flexDirection: 'row', alignItems: 'center', gap: 7 },
  tgBtn: { height: 44, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#2AABEE', flexDirection: 'row', alignItems: 'center', gap: 7 },
  aside: { width: 320, flexShrink: 0, gap: 18 },
  liveCard: { backgroundColor: '#0B1220', borderRadius: 24, padding: 16, gap: 12 },
  slideThumb: { position: 'relative', borderRadius: 14, overflow: 'hidden', width: '100%', aspectRatio: 288 / 162 },
  slideChip: { position: 'absolute', left: 10, bottom: 10, height: 30, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(11,18,32,0.82)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordsCard: { flexShrink: 1, minHeight: 0, backgroundColor: '#FFFFFF', borderRadius: 24, paddingTop: 16, paddingHorizontal: 18, paddingBottom: 12, gap: 4 },
  wordRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  reward: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D5DBE7', borderRadius: 18, paddingVertical: 11, paddingHorizontal: 14 },
  rItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
