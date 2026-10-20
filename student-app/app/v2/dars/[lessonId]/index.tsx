/**
 * v2 Dars (dizayn: 08 Lesson).
 *
 * Eski homework/lesson/[lessonId]/index.tsx bilan bir xil ma'lumot:
 * dars nomi (mobile-content), so'zlar soni, uyga vazifa qismlari va
 * lessonProgressStore'dagi bajarilish belgilari. Qadamlar tartibi
 * dizayndagidek: so'zlar → audio dialoglar → jonli dars/videodars → vazifa → yakun.
 * Jonli dars davomiyligi — to'lov ma'lumotidagi tarif (lessonDuration).
 * "Mukofot" qatori: har to'g'ri javob +1 coin va +1 chaqmoq beradi, shuning
 * uchun eng ko'pi — avtomatik tekshiriladigan savollar soni. Streak serverda
 * yo'q — 0 kun.
 */
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useHomeworkScores } from '@/components/v2/homework/scoreStore';
import {
  currentStep,
  getAudioTracks,
  hasCyrillic,
  homeworkSummary,
  learnedWordIds,
  lessonSteps,
  loadCourseData,
  pad,
  useListened,
  useSeenWords,
  whenLabel,
  type CourseData,
  type Step,
} from '@/components/v2/lessons/data';
import {
  ArrowRight,
  BoltIcon,
  CameraIcon,
  CardsIcon,
  Check,
  ChevronRight,
  FlagIcon,
  HeadphonesIcon,
  LockIcon,
  PencilIcon,
  PlayIcon,
  ScreenIcon,
  SmallFlameIcon,
  TelegramIcon,
} from '@/components/v2/lessons/icons';
import { BottomBar, Center, Column, TitleHeader } from '@/components/v2/lessons/parts';
import { RichText } from '@/components/RichText';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { fetchDemoSchedule, fetchDemoStudentPayments } from '@/services/contentApi';
import { useLessonProgress } from '@/services/lessonProgressStore';
import { DLesson } from '@/components/v2/desktop/lessons/DLesson';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

type Live = { startsAt: Date | null; link: string };

// Kompyuterda (keng web oyna) — DLesson dizayni; telefonda mobil ekran o'zgarishsiz.
export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  return useIsDesktop() ? <DLesson id={String(lessonId)} /> : <LessonScreenMobile />;
}

function LessonScreenMobile() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const id = String(lessonId);
  const [data, setData] = useState<CourseData | null>(null);
  const [error, setError] = useState(false);
  const [live, setLive] = useState<Live>({ startsAt: null, link: '' });
  useLessonProgress(id); // progress o'zgarsa qayta chiziladi
  const listened = useListened(id);
  const seen = useSeenWords(id);
  const scores = useHomeworkScores();
  const [duration, setDuration] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadCourseData().then((d) => !cancelled && setData(d)).catch(() => !cancelled && setError(true));
      fetchDemoSchedule()
        .then((s) => !cancelled && setLive({ startsAt: s.startsAt ? new Date(s.startsAt) : null, link: s.telegramGroupLink }))
        .catch(() => {});
      fetchDemoStudentPayments()
        .then((p) => !cancelled && p && setDuration(p.lessonDuration))
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const lesson = data?.lessons.find((l) => l.id === id);
  if (!data || !lesson) {
    return (
      <View style={styles.screen}>
        <Column>
          <TitleHeader title="Dars" fallback={R.path} />
          <Center>
            <Text style={styles.sub}>{error || (data && !lesson) ? 'Darsni yuklab boʻlmadi.' : 'Yuklanmoqda…'}</Text>
          </Center>
        </Column>
      </View>
    );
  }

  const tracks = getAudioTracks(data.mc, id);
  const heard = listened.filter((x) => tracks.some((t) => t.id === x)).length;
  const steps = lessonSteps(lesson, tracks.length, heard);
  const cur = currentStep(steps);
  const kind = lesson.isVideo ? 'Videodars' : 'Jonli dars';
  const isNextLive = !lesson.isVideo && data.activeIndex === lesson.index && live.startsAt;
  const whenText = isNextLive ? whenLabel(live.startsAt!) : '';
  const allDone = steps.every((s) => s.done);
  const [title, phrase] = (() => {
    const m = lesson.name.match(/^(.*?)\s+[—–-]\s+(.+)$/);
    return m ? [m[1], m[2]] : [lesson.name, ''];
  })();
  // "Darsdan keyin: ..." — CRM'dagi konspekt (dars maqsadi). Bo'lmasa blok ko'rinmaydi.
  const adminKonspekt = data.mc.lessonContents[id]?.konspekt?.trim();
  const hw = homeworkSummary(lesson, scores[id]);
  const vocabCount = lesson.content.vocabulary.length;
  const learned = learnedWordIds(id, lesson.content.vocabulary.map((w) => w.id), seen).size;
  const slidesCount = lesson.content.slides.length;
  // Hozir tinglanayotgan dialog — birinchi tinglanmagani.
  const dialogNo = tracks.length ? Math.min(tracks.length, heard + (steps[1].done ? 0 : 1)) : 0;
  // Jonli dars: bugun bo'lsa faqat soat (sarlavhada "bugun" bor), aks holda kun bilan.
  const liveTime = isNextLive
    ? whenText.startsWith('bugun')
      ? `${pad(live.startsAt!.getHours())}:${pad(live.startsAt!.getMinutes())}`
      : capital(whenText)
    : '';
  const liveSub = liveTime
    ? `${liveTime}${duration ? ` · ${duration} daq` : ''}`
    : lesson.attendanceTaken
      ? 'Qatnashdingiz'
      : 'Ustoz bilan';
  const hwStatus = hw.done ? 'bajarildi' : hw.answered > 0 ? 'davom etmoqda' : 'avtomatik tekshiriladi';
  const hwSub = [hw.letters.length ? hw.letters.join(' + ') : '', `${hw.answered} / ${hw.total}`, hwStatus].filter(Boolean).join(' · ');

  const stepState = (k: number): 'done' | 'current' | 'todo' => (steps[k].done ? 'done' : k === cur ? 'current' : 'todo');

  const cta = ctaFor(steps[cur], lesson.isVideo, id);

  return (
    <View style={styles.screen}>
      <Column>
        <TitleHeader
          title={`${lesson.number}-dars · ${kind}`}
          subtitle={`Qadam ${Math.min(steps.length, steps.filter((s) => s.done).length + (allDone ? 0 : 1))} / ${steps.length}${whenText.startsWith('bugun') ? ' · bugun' : ''}`}
          fallback={R.path}
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Image source={designImages.c04932e65803a7f5c40ff5868fd21516} style={styles.heroImg} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            <View style={styles.heroText}>
              <Text style={[styles.heroTitle, { fontFamily: hasCyrillic(title) ? fonts.displayCyrillic : fonts.display }]}>{title}</Text>
              {!!phrase && <Text style={styles.heroPhrase}>{phrase}</Text>}
            </View>
            {!!adminKonspekt && (
              <View style={styles.goal}>
                <View style={styles.goalCheck}><Check size={12} /></View>
                <Text style={styles.goalText}>
                  Darsdan keyin: <Text style={{ fontFamily: fonts.bodyHeavy }}><RichText inline style={{ fontFamily: fonts.bodyHeavy }} text={adminKonspekt} /></Text>
                </Text>
              </View>
            )}
          </View>

          <StepRow
            state={stepState(0)}
            icon={stepState(0) === 'done' ? <Check size={20} color="#087A4A" strokeWidth={3} /> : <CardsMini active={stepState(0) === 'current'} />}
            iconBg={stepState(0) === 'done' ? '#E3F7EE' : stepState(0) === 'current' ? '#2F5BFF' : '#F0EBFF'}
            title="Yangi soʻzlar"
            sub={steps[0].done ? `${vocabCount} / ${vocabCount} · takrorlash` : `${learned} / ${vocabCount}${stepState(0) === 'current' ? ' · hozir shu yerda' : ''}`}
            onPress={() => router.push(R.wordList(id) as Href)}
          />
          <StepRow
            state={stepState(1)}
            icon={stepState(1) === 'done' ? <Check size={20} color="#087A4A" strokeWidth={3} /> : <HeadphonesIcon color={stepState(1) === 'current' ? '#FFFFFF' : '#1E3FD1'} />}
            iconBg={stepState(1) === 'done' ? '#E3F7EE' : stepState(1) === 'current' ? '#2F5BFF' : '#E8EEFF'}
            title="Audio dialoglar"
            sub={
              stepState(1) === 'current' && tracks.length
                ? `${dialogNo}-dialog tinglanmoqda · ${dialogNo} / ${tracks.length}`
                : `${heard} / ${tracks.length} tinglandi${steps[1].done && tracks.length ? ' · bajarildi' : ''}`
            }
            onPress={() => router.push(R.audioDialog(id) as Href)}
          />
          {lesson.isVideo ? (
            <StepRow
              state={stepState(2)}
              icon={stepState(2) === 'done' ? <Check size={20} color="#087A4A" strokeWidth={3} /> : <PlayIcon size={19} color={stepState(2) === 'current' ? '#FFFFFF' : '#B42318'} />}
              iconBg={stepState(2) === 'done' ? '#E3F7EE' : stepState(2) === 'current' ? '#2F5BFF' : '#FDECEC'}
              title="Videodars"
              sub={steps[2].done ? 'Koʻrilgan · qayta koʻrish' : 'Video va konspekt'}
              onPress={() => router.push(R.video(id) as Href)}
            />
          ) : (
            <View style={[styles.step, stepState(2) === 'current' && styles.stepCurrent]}>
              <View style={styles.stepMain}>
                <View style={[styles.stepIcon, { backgroundColor: stepState(2) === 'done' ? '#E3F7EE' : '#FDECEC' }]}>
                  {stepState(2) === 'done' ? <Check size={20} color="#087A4A" strokeWidth={3} /> : <CameraIcon />}
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>Jonli dars</Text>
                  <Text style={styles.stepSub}>{liveSub}</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Slaydlar, ${slidesCount} ta`}
                onPress={() => router.push(R.slides(id) as Href)}
                style={({ pressed }) => [styles.slidesBtn, pressed && { opacity: 0.85 }]}
              >
                <ScreenIcon />
                <Text style={styles.slidesText}>Slaydlar</Text>
              </Pressable>
              {!!live.link && (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="Telegram guruhga oʻtish"
                  onPress={() => Linking.openURL(live.link).catch(() => {})}
                  style={({ pressed }) => [styles.tgBtn, pressed && { opacity: 0.85 }]}
                >
                  <TelegramIcon />
                </Pressable>
              )}
            </View>
          )}
          <StepRow
            state={stepState(3)}
            icon={stepState(3) === 'done' ? <Check size={20} color="#087A4A" strokeWidth={3} /> : <PencilIcon color={stepState(3) === 'current' ? '#FFFFFF' : '#7A5300'} />}
            iconBg={stepState(3) === 'done' ? '#E3F7EE' : stepState(3) === 'current' ? '#2F5BFF' : '#FFF4D1'}
            title="Uyga vazifa"
            sub={hwSub}
            onPress={() => router.push(R.homework(id) as Href)}
          />
          {allDone ? (
            <StepRow
              state="current"
              icon={<FlagIcon color="#FFFFFF" />}
              iconBg="#2F5BFF"
              title="Darsni yakunlash"
              sub="Hammasi bajarildi"
              onPress={() => router.push(R.complete(id) as Href)}
            />
          ) : (
            <View style={[styles.step, { backgroundColor: '#EEF1F7' }]} accessibilityLabel="Darsni yakunlash, uyga vazifadan keyin ochiladi" accessibilityState={{ disabled: true }}>
              <View style={styles.stepMain}>
                <View style={[styles.stepIcon, { backgroundColor: '#E2E6EE' }]}><FlagIcon /></View>
                <View style={styles.stepText}>
                  <Text style={[styles.stepTitle, { color: '#4A5468' }]}>Darsni yakunlash</Text>
                  <Text style={styles.stepSub}>Uyga vazifadan keyin ochiladi</Text>
                </View>
              </View>
              <LockIcon />
            </View>
          )}
          <View accessibilityLabel="Dars mukofoti" style={styles.reward}>
            <Text style={styles.rewardLabel}>Mukofot:</Text>
            <View style={styles.rewardItem}>
              <View style={styles.coinDot} />
              <Text style={[styles.rewardText, { color: '#7A5300' }]}>+{hw.total} coin gacha</Text>
            </View>
            <View style={[styles.rewardItem, { gap: 3 }]}>
              <BoltIcon size={15} />
              <Text style={[styles.rewardText, { color: '#6A3CF0' }]}>+{hw.total}</Text>
            </View>
            <View style={[styles.rewardItem, { gap: 3 }]}>
              <SmallFlameIcon />
              <Text style={[styles.rewardText, { color: '#B34700' }]}>0 kun</Text>
            </View>
          </View>
        </ScrollView>
        <BottomBar>
          <Pressable accessibilityRole="link" onPress={cta.onPress} style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
            <Text style={styles.ctaText}>{cta.label}</Text>
            <ArrowRight />
          </Pressable>
        </BottomBar>
      </Column>
    </View>
  );
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ctaFor(step: Step, isVideo: boolean, id: string): { label: string; onPress: () => void } {
  const go = (h: string) => () => router.push(h as Href);
  switch (step.key) {
    case 'vocab': return { label: step.fraction > 0 ? 'Soʻzlarni davom ettirish' : 'Soʻzlarni boshlash', onPress: go(R.vocab(id)) };
    case 'audio': return { label: 'Audio dialogni davom ettirish', onPress: go(R.audioDialog(id)) };
    case 'main': return isVideo ? { label: 'Videodarsni koʻrish', onPress: go(R.video(id)) } : { label: 'Slaydlarni koʻrish', onPress: go(R.slides(id)) };
    case 'homework': return { label: 'Uyga vazifani davom ettirish', onPress: go(R.homework(id)) };
    default: return { label: 'Darsni yakunlash', onPress: go(R.complete(id)) };
  }
}

// Dizaynda faqat "bajarildi" holati bor — bajarilmaganda kartochkalar ikonkasi.
function CardsMini({ active }: { active: boolean }) {
  return <CardsIcon color={active ? '#FFFFFF' : '#5A2FD6'} />;
}

function StepRow({
  state,
  icon,
  iconBg,
  title,
  sub,
  onPress,
}: {
  state: 'done' | 'current' | 'todo';
  icon: ReactNode;
  iconBg: string;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.step, state === 'current' && styles.stepCurrent, pressed && { opacity: 0.85 }]}>
      <View style={styles.stepMain}>
        <View style={[styles.stepIcon, { backgroundColor: iconBg }]}>{icon}</View>
        <View style={styles.stepText}>
          <Text style={styles.stepTitle}>{title}</Text>
          <Text style={styles.stepSub}>{sub}</Text>
        </View>
      </View>
      <ChevronRight color={state === 'current' ? '#2F5BFF' : '#5B6478'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { paddingTop: 16, paddingHorizontal: 20, gap: 12, paddingBottom: 8 },
  sub: { fontFamily: fonts.body, fontSize: 14, color: '#4A5468' },
  hero: { backgroundColor: '#E8EEFF', borderRadius: 24, paddingTop: 16, paddingRight: 16, paddingBottom: 14, paddingLeft: 18, gap: 10, overflow: 'hidden', position: 'relative' },
  heroImg: { position: 'absolute', right: 8, top: 6, width: 92, height: 82 },
  heroText: { maxWidth: 220, minHeight: 76, justifyContent: 'center', gap: 2 },
  heroTitle: { fontSize: 23, lineHeight: 24.8, letterSpacing: -0.46, color: '#0B1220', fontWeight: 'normal' },
  heroPhrase: { fontFamily: fonts.bodyHeavy, fontSize: 18, lineHeight: 24, color: '#1E3FD1', fontWeight: 'normal' },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 },
  goalCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#087A4A', alignItems: 'center', justifyContent: 'center' },
  goalText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 19, color: '#0B1220', fontWeight: 'normal' },
  step: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepCurrent: { boxShadow: '0 0 0 2px #2F5BFF, 0 8px 22px rgba(47,91,255,0.16)' } as object,
  stepMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  stepIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, minWidth: 0, gap: 1 },
  stepTitle: { fontFamily: fonts.bodyHeavy, fontSize: 15, lineHeight: 20, color: '#0B1220', fontWeight: 'normal' },
  stepSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: '#4A5468', fontWeight: 'normal' },
  slidesBtn: { height: 44, paddingHorizontal: 10, borderRadius: 13, backgroundColor: '#F4F6FA', flexDirection: 'row', alignItems: 'center', gap: 5 },
  slidesText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#0B1220', fontWeight: 'normal' },
  tgBtn: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#2AABEE', alignItems: 'center', justifyContent: 'center' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D5DBE7', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  rewardLabel: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#4A5468', fontWeight: 'normal' },
  rewardItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rewardText: { fontFamily: fonts.bodyHeavy, fontSize: 14, fontWeight: 'normal' },
  coinDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F5B70A', boxShadow: 'inset 0 -2px 0 #C98F00' } as object,
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 6px 0 #1E3FD1' } as object,
  ctaText: { fontFamily: fonts.bodyHeavy, fontSize: 17, color: '#FFFFFF', fontWeight: 'normal' },
});
