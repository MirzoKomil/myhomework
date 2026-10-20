/**
 * v2 Audio dialoglar (dizayn: 10 AudioDialog).
 *
 * Audio manbasi: CRM'da darsning modullariga biriktirilgan audio fayl
 * havolalari (getAudioTracks). Dialog matni — o'sha moduldagi "Matn"
 * kontenti: "Ism: ruscha gap" qatoridan keyingi qator — tarjimasi.
 * Pleer eski podkast ekranidagi kabi expo-audio bilan ishlaydi.
 * CRM audio dialogida replika vaqtlari (start) berilgan bo'lsa — joriy
 * replika, oldingi/keyingi va "replikani takrorlash" shu aniq vaqtlar bo'yicha;
 * berilmagan bo'lsa — audio davomiyligi replikalar soniga teng bo'lib
 * taxminlanadi. Har replikadan keyin 3 soniya "Endi takrorlang" pauzasi.
 * Kitob qismi / trek raqami — CRM'da kiritilgan bo'lsa shu, aks holda
 * taxminiy: qism — oy raqami, trek — shu qismdagi darslar audiolari tartibi.
 * Audio yo'q bo'lsa — dizayndagi joylashuv bo'sh holatda ko'rsatiladi.
 */
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  bookPart,
  bookTrackNo,
  buildQuickCheck,
  eventAt,
  fmtTime,
  getAudioTracks,
  lineStarts,
  lineTimeline,
  loadCourseData,
  markListened,
  speakerColor,
  speakersOf,
  splitTitle,
  trackLines,
  useListened,
  type CourseData,
} from '@/components/v2/lessons/data';
import {
  ArrowRight,
  ChevronRight,
  ClockIcon,
  PauseIcon,
  PlayIcon,
  QrIcon,
  RepeatOneIcon,
  ScreenIcon,
  SkipNextIcon,
  SkipPrevIcon,
} from '@/components/v2/lessons/icons';
import { Column, HeaderButton } from '@/components/v2/lessons/parts';
import { RichText } from '@/components/RichText';
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { saveLastPosition } from '@/services/progressStore';
import { DAudioDialog } from '@/components/v2/desktop/lessons/DAudioDialog';
import { useIsDesktop } from '@/components/v2/desktop/useDesktop';

const SPEEDS = [0.75, 1, 1.25];
const PAUSE_MS = 3000;

// Kompyuterda (keng web oyna) — DAudioDialog dizayni; telefonda mobil ekran o'zgarishsiz.
export default function AudioDialogScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  return useIsDesktop() ? <DAudioDialog id={String(lessonId)} /> : <AudioDialogScreenMobile />;
}

function AudioDialogScreenMobile() {
  const insets = useSafeAreaInsets();
  const { lessonId, d } = useLocalSearchParams<{ lessonId: string; d?: string }>();
  const id = String(lessonId);
  const [data, setData] = useState<CourseData | null>(null);
  const [failed, setFailed] = useState(false);
  const [trackIdx, setTrackIdx] = useState(() => Math.max(0, Number(d) || 0));
  const [showUz, setShowUz] = useState(true);
  const listened = useListened(id);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadCourseData()
        .then((x) => !cancelled && setData(x))
        .catch(() => !cancelled && setFailed(true));
      return () => {
        cancelled = true;
      };
    }, []),
  );
  useEffect(() => {
    saveLastPosition({ lessonId: id, section: 'audio', label: 'Audio dialoglar' });
  }, [id]);

  const mc = data?.mc ?? null;
  const lesson = data?.lessons.find((l) => l.id === id);
  const tracks = useMemo(() => (mc ? getAudioTracks(mc, id) : []), [mc, id]);
  const track = tracks[trackIdx];
  const lines = useMemo(() => (mc && track ? trackLines(mc, track) : []), [mc, track]);
  const nextTrack = tracks[trackIdx + 1];
  const quickCount = useMemo(() => buildQuickCheck(lines, []).length, [lines]);

  const player = useAudioPlayer(track ? { uri: track.url } : null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [pausedAfter, setPausedAfter] = useState<number | null>(null);
  const lastLine = useRef(-1);
  // O'qilayotgan replika ekrandan chiqib ketsa, matnni o'zi suramiz.
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const viewH = useRef(0);
  const textY = useRef(0);
  const lineBox = useRef<{ y: number; h: number }[]>([]);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [barW, setBarW] = useState(0);

  const duration = status.duration || 0;
  const t = status.currentTime || 0;
  const frac = duration > 0 ? Math.min(1, t / duration) : 0;
  const starts = useMemo(() => lineStarts(lines, duration), [lines, duration]);
  // Kitob audiosida "Endi takrorlang" qismi va pauzalar mp3 ning o'zida bor:
  // ilova o'z pauzasini qo'shmaydi, replikani esa ikkala qismda ham belgilaydi.
  const builtInRepeat = typeof track?.repeatFrom === 'number';
  const events = useMemo(() => lineTimeline(lines, starts), [lines, starts]);
  const rawEv = lines.length && duration > 0 ? eventAt(events, t) : -1;
  const evIdx = lines.length && duration > 0 ? eventAt(events, t, track?.repeatFrom) : -1;
  const curLine = evIdx >= 0 ? events[evIdx].k : -1;
  const inRepeat = builtInRepeat && duration > 0 && t + 0.05 >= (track?.repeatFrom ?? Infinity);
  useEffect(() => {
    const box = curLine >= 0 ? lineBox.current[curLine] : undefined;
    if (!box || !viewH.current) return;
    const top = textY.current + box.y;
    const bottom = top + box.h + 56;
    if (bottom > scrollY.current + viewH.current - 40) scrollRef.current?.scrollTo({ y: bottom - viewH.current + 80, animated: true });
    else if (top < scrollY.current) scrollRef.current?.scrollTo({ y: Math.max(0, top - 16), animated: true });
  }, [curLine]);

  // Yangi trekka o'tganda holatni tozalaymiz.
  useEffect(() => {
    lastLine.current = -1;
    setPausedAfter(null);
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
  }, [trackIdx]);

  useEffect(
    () => () => {
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
    },
    [],
  );

  // Replika tugashi bilan 3 soniya takrorlash pauzasi.
  useEffect(() => {
    if (builtInRepeat || !status.playing || curLine < 0) return;
    if (lastLine.current >= 0 && curLine > lastLine.current) {
      const done = lastLine.current;
      player.pause();
      setPausedAfter(done);
      pauseTimer.current = setTimeout(() => {
        setPausedAfter(null);
        player.play();
      }, PAUSE_MS);
    }
    lastLine.current = curLine;
  }, [curLine, status.playing, player, builtInRepeat]);

  useEffect(() => {
    if (status.didJustFinish && track) {
      markListened(id, track.id);
      lastLine.current = -1;
    }
  }, [status.didJustFinish, track, id]);

  const clearPause = () => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    setPausedAfter(null);
  };
  const togglePlay = () => {
    if (!track) return;
    if (pausedAfter !== null) {
      clearPause();
      return;
    }
    if (status.playing) player.pause();
    else {
      if (duration > 0 && t >= duration - 0.2) player.seekTo(0);
      player.play();
    }
  };
  // Oldingi / keyingi / takrorlash — vaqt chizig'idagi hodisalar bo'yicha
  // (kitob audiosida "Endi takrorlang" qismidagi replikalar ham kiradi).
  const seekEvent = (i: number) => {
    if (!track || !duration || !events.length) return;
    clearPause();
    lastLine.current = -1;
    const e = events[Math.max(0, Math.min(events.length - 1, i))];
    player.seekTo(e.t).then(() => player.play());
  };
  const cycleSpeed = () => {
    const n = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(n);
    player.setPlaybackRate(SPEEDS[n]);
  };
  const onSeekBar = (x: number) => {
    if (!track || !barW || !duration) return;
    lastLine.current = -1;
    player.seekTo(Math.max(0, Math.min(1, x / barW)) * duration);
  };
  const goTrack = (k: number) => {
    player.pause();
    setTrackIdx(k);
  };

  const speakers = speakersOf(lines);
  const legend = speakers.map((sp) => `${sp.charAt(0).toUpperCase()} — ${sp.toLowerCase()}`).join(' · ');
  const playing = status.playing || pausedAfter !== null;
  const dialogNo = tracks.length ? trackIdx + 1 : 0;
  const topic = lesson ? splitTitle(lesson.name).title.split(/\s+/)[0] : '';
  const trackNo = track?.trackNo ?? (data && lesson ? bookTrackNo(data.mc, data.lessons, lesson.index, trackIdx) : 0);
  const partNo = track?.bookPart ?? (lesson ? bookPart(lesson.index) : null);
  const speedLabel = `${SPEEDS[speedIdx]}×`;

  return (
    <View style={styles.screen}>
      <Column>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 10 }]}>
          <HeaderButton kind="close" label="Yopish" fallback={R.lesson(id)} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.headRow}>
              <Text style={styles.headTitle}>Dialog {dialogNo} / {tracks.length}</Text>
              <Text style={styles.headStep}>Dars qadami 2 / 5</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`Dialog ${dialogNo} / ${tracks.length}`}>
              {(tracks.length ? tracks : [null]).map((tr, k) => {
                const isHeard = !!tr && listened.includes(tr.id);
                const fill = k === trackIdx ? frac : isHeard ? 1 : 0;
                return (
                  <View key={k} style={[styles.seg, { backgroundColor: k === trackIdx && tr ? '#D4DEFF' : isHeard ? '#2F5BFF' : '#E2E6EE' }]}>
                    <View style={{ width: `${fill * 100}%`, height: 8, backgroundColor: '#2F5BFF' }} />
                  </View>
                );
              })}
            </View>
          </View>
          <Pressable accessibilityRole="link" accessibilityLabel="Slaydlar" onPress={() => router.push(R.slides(id) as Href)} style={({ pressed }) => [styles.hbtn, pressed && { opacity: 0.85 }]}>
            <ScreenIcon size={20} round />
          </Pressable>
        </View>

        <View style={{ flex: 1, position: 'relative' }}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={64}
            onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
            onLayout={(e) => (viewH.current = e.nativeEvent.layout.height)}
          >
            <View style={styles.top}>
              <Image
                source={track?.coverUrl ? { uri: track.coverUrl } : designImages.d9c9d8d26328b24384a9840cf989fb7b}
                style={styles.cover}
                resizeMode="cover"
                accessibilityLabel="Dialog sahnasi"
              />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={styles.overline}>Audio dialog{topic ? ` · ${topic}` : ''}</Text>
                <Text accessibilityRole="header" style={styles.h1}>
                  {track ? track.title : failed ? 'Yuklab boʻlmadi' : data ? 'Audio hali qoʻshilmagan' : 'Yuklanmoqda…'}
                </Text>
                <View style={styles.qr}>
                  <QrIcon />
                  <Text style={styles.qrText}>
                    Kitob · {partNo ?? '—'}-qism · {lesson?.number ?? '—'}-dars · {tracks.length ? trackNo : 0}-trek
                  </Text>
                </View>
              </View>
            </View>

            <View accessibilityLabel="Pleer" style={styles.player}>
              <View style={{ gap: 5 }}>
                <Pressable
                  accessibilityRole="adjustable"
                  accessibilityLabel="Ijro joyi"
                  onLayout={(e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width)}
                  onPress={(e) => onSeekBar(e.nativeEvent.locationX)}
                  style={{ paddingVertical: 5, marginVertical: -5 }}
                >
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${frac * 100}%` }]} />
                    <View style={[styles.knob, { left: `${frac * 100}%` }]} />
                  </View>
                </Pressable>
                <View style={styles.times}>
                  <Text style={styles.time}>{fmtTime(t)}</Text>
                  <Text style={styles.time}>{track?.duration && !duration ? track.duration : fmtTime(duration)}</Text>
                </View>
              </View>
              <View style={styles.controls}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Tezlik: ${speedLabel} (0.75× / 1× / 1.25×)`} onPress={cycleSpeed} style={styles.speed}>
                  <Text style={styles.speedText}>{speedLabel}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Oldingi replika" onPress={() => seekEvent(rawEv - 1)} style={styles.round}>
                  <SkipPrevIcon />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pauza' : 'Ijro etish'} disabled={!track} onPress={togglePlay} style={[styles.play, !track && { opacity: 0.5 }]}>
                  {playing ? <PauseIcon /> : <PlayIcon size={26} color="#FFFFFF" />}
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Keyingi replika" onPress={() => seekEvent(rawEv + 1)} style={styles.round}>
                  <SkipNextIcon />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Replikani takrorlash" onPress={() => seekEvent(Math.max(0, rawEv))} style={styles.speed}>
                  <RepeatOneIcon />
                </Pressable>
              </View>
            </View>

            <View accessibilityLabel="Matn" style={styles.text} onLayout={(e) => (textY.current = e.nativeEvent.layout.y)}>
              <View style={styles.textHead}>
                <View style={{ gap: 1, minWidth: 0, flexShrink: 1 }}>
                  <Text style={styles.textOver}>Matn</Text>
                  {!!legend && <Text style={styles.legend}>{legend}</Text>}
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: showUz }}
                  accessibilityLabel="UZ tarjima"
                  onPress={() => setShowUz((v) => !v)}
                  style={styles.switchBtn}
                >
                  <Text style={styles.switchText}>UZ tarjima</Text>
                  <View style={[styles.switchTrack, { backgroundColor: showUz ? '#2F5BFF' : '#C9D0DE' }]}>
                    <View style={[styles.switchKnob, showUz ? { right: 3 } : { left: 3 }]} />
                  </View>
                </Pressable>
              </View>
              {lines.length === 0 ? (
                <View style={styles.line}>
                  <Text style={[styles.uz, { paddingVertical: 4 }]}>
                    {track ? 'Bu dialogga matn qoʻshilmagan.' : 'Bu darsga hali audio dialog qoʻshilmagan.'}
                  </Text>
                </View>
              ) : (
                lines.map((l, k) => {
                  const isCur = k === curLine && pausedAfter === null;
                  const future = curLine >= 0 && k > curLine;
                  return (
                    <View key={k} onLayout={(e) => (lineBox.current[k] = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}>
                      <View style={[styles.line, isCur && styles.lineCur]}>
                        <View style={[styles.avatar, { backgroundColor: speakerColor(speakers, l.speaker) }]} accessibilityRole="image" accessibilityLabel={l.speaker}>
                          <Text style={styles.avatarText}>{l.speaker.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                          <RichText style={[styles.ru, isCur && { fontFamily: fonts.bodyHeavy }, future && { color: '#4A5468' }]} text={l.ru} />
                          {showUz && !!l.uz && <RichText style={styles.uz} text={l.uz} />}
                        </View>
                      </View>
                      {(pausedAfter === k || (inRepeat && k === curLine)) && (
                        <View accessibilityRole="alert" style={styles.repeatBox}>
                          <PauseIcon size={16} color="#7A5300" />
                          <Text style={styles.repeatText}>Endi takrorlang</Text>
                          <Text style={styles.repeatSub}>{inRepeat ? 'ovoz chiqarib' : 'pauza 3 s'}</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
          <LinearGradient colors={['rgba(244,246,250,0)', '#F4F6FA']} style={styles.fade} pointerEvents="none" />
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 0) + 30 }]}>
          {nextTrack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Keyingi dialog, ${trackIdx + 2} / ${tracks.length}`}
              onPress={() => goTrack(trackIdx + 1)}
              style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}
            >
              <Text style={styles.ctaText}>Keyingi dialog ·</Text>
              <Text style={styles.ctaText} numberOfLines={1}>{nextTrack.title}</Text>
              <ArrowRight strokeWidth={2.6} />
            </Pressable>
          ) : (
            <Pressable accessibilityRole="link" onPress={() => router.replace(R.lesson(id) as Href)} style={({ pressed }) => [styles.cta, pressed && { backgroundColor: '#1E3FD1' }]}>
              <Text style={styles.ctaText}>Darsga qaytish</Text>
              <ArrowRight strokeWidth={2.6} />
            </Pressable>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Dialog tugagach: Tez tekshiruv, ${quickCount} savol`}
              onPress={() => router.push(`${R.quickCheck(id)}?d=${trackIdx}` as Href)}
              style={({ pressed }) => [styles.quick, pressed && { opacity: 0.85 }]}
            >
              <ClockIcon />
              <View style={{ flex: 1 }}>
                <Text style={styles.quickOver}>Dialog tugagach:</Text>
                <Text style={styles.quickTitle}>Tez tekshiruv · {quickCount} savol</Text>
              </View>
              <ChevronRight size={16} color="#1E3FD1" />
            </Pressable>
          </View>
        </View>
      </Column>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  hbtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  headTitle: { fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#0B1220', fontWeight: 'normal' },
  headStep: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#4A5468', fontWeight: 'normal' },
  seg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  content: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cover: { width: 76, height: 76, borderRadius: 20 },
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: '#1E3FD1', fontWeight: 'normal' },
  h1: { fontFamily: fonts.bodyHeavy, fontSize: 23, lineHeight: 25.3, letterSpacing: -0.23, color: '#0B1220', fontWeight: 'normal' },
  qr: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E6EE', borderRadius: 9, paddingVertical: 4, paddingHorizontal: 8 },
  qrText: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#4A5468', fontWeight: 'normal' },
  player: { backgroundColor: '#0B1220', borderRadius: 22, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  bar: { position: 'relative', height: 6, borderRadius: 3, backgroundColor: '#2B3550' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#6D8BFF' },
  knob: { position: 'absolute', top: -5, width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: '#FFFFFF' },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#B8C1D6', fontVariant: ['tabular-nums'], fontWeight: 'normal' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  speed: { height: 44, minWidth: 56, paddingHorizontal: 8, borderRadius: 14, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  speedText: { fontFamily: fonts.bodyHeavy, fontSize: 15, color: '#FFFFFF', fontWeight: 'normal' },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  text: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 8, gap: 2 },
  textHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 4, paddingRight: 4, paddingLeft: 12 },
  textOver: { fontFamily: fonts.bodyHeavy, fontSize: 11, letterSpacing: 0.66, textTransform: 'uppercase', color: '#4A5468', fontWeight: 'normal' },
  legend: { fontFamily: fonts.bodyBold, fontSize: 12, color: '#4A5468', fontWeight: 'normal' },
  switchBtn: { height: 44, paddingLeft: 12, paddingRight: 10, borderRadius: 14, backgroundColor: '#F4F6FA', flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  switchText: { fontFamily: fonts.bodyHeavy, fontSize: 13, color: '#0B1220', fontWeight: 'normal' },
  switchTrack: { width: 36, height: 22, borderRadius: 11, position: 'relative' },
  switchKnob: { position: 'absolute', top: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF' },
  line: { borderRadius: 14, paddingVertical: 7, paddingRight: 10, paddingLeft: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  lineCur: { backgroundColor: '#E8EEFF', boxShadow: 'inset 4px 0 0 #2F5BFF' } as object,
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  avatarText: { fontFamily: fonts.bodyHeavy, fontSize: 12, color: '#FFFFFF', fontWeight: 'normal' },
  ru: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19.5, color: '#0B1220', fontWeight: 'normal' },
  uz: { fontFamily: fonts.body, fontSize: 13, lineHeight: 16.9, color: '#4A5468', fontWeight: 'normal' },
  repeatBox: { marginVertical: 2, marginHorizontal: 4, height: 44, borderRadius: 12, backgroundColor: '#FFF4D1', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  repeatText: { flex: 1, fontFamily: fonts.bodyHeavy, fontSize: 14, color: '#7A5300', fontWeight: 'normal' },
  repeatSub: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#7A5300', fontWeight: 'normal' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 64 },
  footer: { paddingTop: 10, paddingHorizontal: 20, gap: 10, flexShrink: 0 },
  cta: { height: 56, borderRadius: 18, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, boxShadow: '0 5px 0 #1E3FD1' } as object,
  ctaText: { flexShrink: 1, fontFamily: fonts.bodyHeavy, fontSize: 16, color: '#FFFFFF', fontWeight: 'normal' },
  quick: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: '#E8EEFF', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingHorizontal: 14 },
  quickOver: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 14.4, color: '#34405A', fontWeight: 'normal' },
  quickTitle: { fontFamily: fonts.bodyHeavy, fontSize: 14, lineHeight: 16.8, color: '#1E3FD1', fontWeight: 'normal' },
});
