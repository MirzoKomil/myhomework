/**
 * Kompyuter: Audio dialoglar (dizayn: D_AudioDialog.dc.html) — fokus rejim.
 *
 * Ijro va matn sinxroni mobil ekrandagi bilan AYNAN bir xil: o'sha
 * lineStarts / lineTimeline / eventAt (lessons/data.ts), o'sha 3 soniyalik
 * "Endi takrorlang" pauzasi, kitob audiosidagi o'rnatilgan takrorlash qismi,
 * oldingi/keyingi/takrorlash — vaqt chizig'idagi hodisalar bo'yicha, joriy
 * replika ko'rinmay qolsa matn o'zi suriladi. Pastdagi effektlar mobil
 * audio.tsx'dan so'zma-so'z ko'chirilgan (mobil fayl o'zgarmasligi uchun).
 * Klaviatura: Space ijro/pauza, ← → replikalar, R takrorlash, S tezlik,
 * T tarjima, Enter keyingi dialog, Esc yopish.
 */
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { RichText } from '@/components/RichText';
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
import { designImages } from '@/constants/v2/designImages';
import { R } from '@/constants/v2/routes';
import { fonts } from '@/constants/v2/tokens';
import { saveLastPosition } from '@/services/progressStore';

import { FocusFrame, Kbd } from '../Shell';
import { useDesktopKeys } from '../useDesktop';
import { DarkKbd, IArrow, IChevron, IClock, IPause, IPlay, IQr, IRepeatOne, IScreen, ISkipNext, ISkipPrev, InKbd, T } from './ui';

const SPEEDS = [0.75, 1, 1.25];
const PAUSE_MS = 3000;

export function DAudioDialog({ id }: { id: string }) {
  const { d } = useLocalSearchParams<{ d?: string }>();
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

  // ─── Pleer (mobil audio.tsx bilan aynan bir xil) ──────────────────────────
  const player = useAudioPlayer(track ? { uri: track.url } : null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [pausedAfter, setPausedAfter] = useState<number | null>(null);
  const lastLine = useRef(-1);
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
  // ──────────────────────────────────────────────────────────────────────────

  const speakers = speakersOf(lines);
  const legend = speakers.map((sp) => `${sp.charAt(0).toUpperCase()} — ${sp.toLowerCase()}`).join(' · ');
  const playing = status.playing || pausedAfter !== null;
  const dialogNo = tracks.length ? trackIdx + 1 : 0;
  const topic = lesson ? splitTitle(lesson.name).title.split(/\s+/)[0] : '';
  const trackNoOf = (k: number) => tracks[k]?.trackNo ?? (data && lesson ? bookTrackNo(data.mc, data.lessons, lesson.index, k) : 0);
  const partNo = track?.bookPart ?? (lesson ? bookPart(lesson.index) : null);
  const speedLabel = `${SPEEDS[speedIdx]}×`;
  const durText = track?.duration && !duration ? track.duration : fmtTime(duration);
  const next = () => (nextTrack ? goTrack(trackIdx + 1) : router.replace(R.lesson(id) as Href));

  useDesktopKeys({
    ' ': togglePlay,
    ArrowLeft: () => seekEvent(rawEv - 1),
    ArrowRight: () => seekEvent(rawEv + 1),
    r: () => seekEvent(Math.max(0, rawEv)),
    s: cycleSpeed,
    t: () => setShowUz((v) => !v),
    Enter: next,
  });

  const header = (
    <View style={{ width: 420, gap: 7 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={13} color="#34405A">
          Dialog {dialogNo} / {tracks.length}
        </T>
        <T f="bodyBold" size={13} color="#4A5468">
          {fmtTime(t)} / {durText}
        </T>
      </View>
      <View accessibilityLabel={`Dialog ${dialogNo} / ${tracks.length}`} style={{ flexDirection: 'row', gap: 5 }}>
        {(tracks.length ? tracks : [null]).map((tr, k) => {
          const isHeard = !!tr && listened.includes(tr.id);
          const fill = k === trackIdx ? frac : isHeard ? 1 : 0;
          return (
            <View key={k} style={[s.seg, { backgroundColor: k === trackIdx && tr ? '#D4DEFF' : isHeard ? '#2F5BFF' : '#E2E6EE' }]}>
              <View style={{ width: `${fill * 100}%`, height: 8, backgroundColor: '#2F5BFF' }} />
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <FocusFrame
      closeTo={R.lesson(id)}
      title={`${lesson?.number ?? ''}-dars · Audio dialoglar`}
      subtitle={lesson ? `${splitTitle(lesson.name).title} · dars qadami 2 / 5` : undefined}
      center={header}
      right={
        <Pressable accessibilityRole="link" onPress={() => router.push(R.slides(id) as Href)} style={({ pressed }) => [s.slidesTop, pressed && { opacity: 0.85 }]}>
          <IScreen size={18} />
          <T size={14}>Slaydlar</T>
        </Pressable>
      }
      footerHeight={100}
      footerWidth={1100}
      footer={
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Dialog tugagach: Tez tekshiruv, ${quickCount} savol`}
            onPress={() => router.push(`${R.quickCheck(id)}?d=${trackIdx}` as Href)}
            style={({ pressed }) => [s.quick, pressed && { opacity: 0.85 }]}
          >
            <IClock />
            <View>
              <T f="bodyBold" size={12} lh={14.4} color="#34405A">
                Dialoglar tugagach:
              </T>
              <T size={15} lh={18} color="#1E3FD1">
                Tez tekshiruv · {quickCount} savol
              </T>
            </View>
            <IChevron size={16} color="#1E3FD1" />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="link" onPress={() => router.push(R.slides(id) as Href)} style={({ pressed }) => [s.second, pressed && { opacity: 0.85 }]}>
            <IScreen size={18} />
            <T size={15}>Slaydlarga oʻtish</T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={nextTrack ? `Keyingi dialog, ${trackIdx + 2} / ${tracks.length} (Enter)` : 'Darsga qaytish (Enter)'}
            onPress={next}
            style={({ pressed }) => [s.cta, pressed && { backgroundColor: '#1E3FD1' }]}
          >
            <T size={16} color="#FFFFFF" lines={1} style={{ flexShrink: 1 }}>
              {nextTrack ? `Keyingi dialog · ${nextTrack.title}` : 'Darsga qaytish'}
            </T>
            <IArrow size={18} />
            <InKbd>Enter</InKbd>
          </Pressable>
        </View>
      }
      scroll={false}
    >
      <View style={s.stage}>
        <View style={s.wrap}>
          <View style={s.left}>
            <View style={s.cover}>
              <Image
                source={track?.coverUrl ? { uri: track.coverUrl } : designImages.d9c9d8d26328b24384a9840cf989fb7b}
                style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
                resizeMode="cover"
                accessibilityLabel="Dialog sahnasi"
              />
              <View style={s.coverChip}>
                <T size={12} color="#1E3FD1" ls={0.72} style={{ textTransform: 'uppercase' }}>
                  Audio dialog{topic ? ` · ${topic}` : ''}
                </T>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <T size={30} lh={33} ls={-0.3}>
                {track ? track.title : failed ? 'Yuklab boʻlmadi' : data ? 'Audio hali qoʻshilmagan' : 'Yuklanmoqda…'}
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <View style={s.qr}>
                  <IQr />
                  <T f="bodyBold" size={13} color="#4A5468">
                    Kitob · {partNo ?? '—'}-qism · {lesson?.number ?? '—'}-dars · {tracks.length ? trackNoOf(trackIdx) : 0}-trek
                  </T>
                </View>
                <T f="bodyBold" size={13} color="#4A5468">
                  {lines.length} replika · {durText}
                </T>
              </View>
            </View>
            <View accessibilityLabel="Pleer" style={s.player}>
              <View style={{ gap: 7 }}>
                <Pressable
                  accessibilityRole="adjustable"
                  accessibilityLabel="Ijro joyi"
                  onLayout={(e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width)}
                  onPress={(e) => onSeekBar(e.nativeEvent.locationX)}
                  style={{ paddingVertical: 5, marginVertical: -5 }}
                >
                  <View style={s.bar}>
                    <View style={[s.barFill, { width: `${frac * 100}%` }]} />
                    <View style={[s.knob, { left: `${frac * 100}%` }]} />
                  </View>
                </Pressable>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T f="bodyBold" size={13} color="#B8C1D6" style={{ fontVariant: ['tabular-nums'] }}>
                    {fmtTime(t)}
                  </T>
                  <T f="bodyBold" size={13} color="#B8C1D6" style={{ fontVariant: ['tabular-nums'] }}>
                    {durText}
                  </T>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Ctl k="S">
                  <Pressable accessibilityRole="button" accessibilityLabel={`Tezlik: ${speedLabel}`} onPress={cycleSpeed} style={s.round}>
                    <T size={15} color="#FFFFFF">
                      {speedLabel}
                    </T>
                  </Pressable>
                </Ctl>
                <Ctl k="←">
                  <Pressable accessibilityRole="button" accessibilityLabel="Oldingi replika (←)" onPress={() => seekEvent(rawEv - 1)} style={s.round}>
                    <ISkipPrev />
                  </Pressable>
                </Ctl>
                <Ctl k="Space">
                  <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pauza (Space)' : 'Ijro etish (Space)'} disabled={!track} onPress={togglePlay} style={[s.play, !track && { opacity: 0.5 }]}>
                    {playing ? <IPause size={28} /> : <IPlay size={28} color="#FFFFFF" />}
                  </Pressable>
                </Ctl>
                <Ctl k="→">
                  <Pressable accessibilityRole="button" accessibilityLabel="Keyingi replika (→)" onPress={() => seekEvent(rawEv + 1)} style={s.round}>
                    <ISkipNext />
                  </Pressable>
                </Ctl>
                <Ctl k="R">
                  <Pressable accessibilityRole="button" accessibilityLabel="Replikani takrorlash (R)" onPress={() => seekEvent(Math.max(0, rawEv))} style={s.round}>
                    <IRepeatOne />
                  </Pressable>
                </Ctl>
              </View>
            </View>
          </View>

          <View style={s.right}>
            <View accessibilityLabel="Matn" style={s.text}>
              <View style={s.textHead}>
                <View style={{ gap: 1, minWidth: 0, flexShrink: 1 }}>
                  <T size={11} color="#4A5468" ls={0.66} style={{ textTransform: 'uppercase' }}>
                    Matn
                  </T>
                  {!!legend && (
                    <T f="bodyBold" size={13} color="#4A5468">
                      {legend}
                    </T>
                  )}
                </View>
                <Pressable accessibilityRole="switch" accessibilityState={{ checked: showUz }} accessibilityLabel="UZ tarjima" onPress={() => setShowUz((v) => !v)} style={s.switchBtn}>
                  <T size={14}>UZ tarjima</T>
                  <View style={[s.switchTrack, { backgroundColor: showUz ? '#2F5BFF' : '#C9D0DE' }]}>
                    <View style={[s.switchKnob, showUz ? { right: 3 } : { left: 3 }]} />
                  </View>
                  <Kbd>T</Kbd>
                </Pressable>
              </View>
              <ScrollView
                ref={scrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={64}
                onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
                onLayout={(e) => (viewH.current = e.nativeEvent.layout.height)}
              >
                <View style={s.lines} onLayout={(e) => (textY.current = e.nativeEvent.layout.y)}>
                  {lines.length === 0 ? (
                    <View style={s.line}>
                      <T f="body" size={14} color="#4A5468">
                        {track ? 'Bu dialogga matn qoʻshilmagan.' : 'Bu darsga hali audio dialog qoʻshilmagan.'}
                      </T>
                    </View>
                  ) : (
                    lines.map((l, k) => {
                      const isCur = k === curLine && pausedAfter === null;
                      const future = curLine >= 0 && k > curLine;
                      return (
                        <View key={k} onLayout={(e) => (lineBox.current[k] = { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}>
                          <View style={[s.line, isCur && s.lineCur]}>
                            <View style={[s.avatar, { backgroundColor: speakerColor(speakers, l.speaker) }]} accessibilityRole="image" accessibilityLabel={l.speaker}>
                              <T size={13} color="#FFFFFF">
                                {l.speaker.charAt(0).toUpperCase()}
                              </T>
                            </View>
                            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                              <RichText style={[s.ru, isCur && { fontFamily: fonts.bodyHeavy }, future && { color: '#4A5468' }]} text={l.ru} />
                              {showUz && !!l.uz && <RichText style={s.uz} text={l.uz} />}
                            </View>
                          </View>
                          {(pausedAfter === k || (inRepeat && k === curLine)) && (
                            <View accessibilityRole="alert" style={s.repeat}>
                              <IPause size={16} color="#7A5300" />
                              <T size={15} color="#7A5300" style={{ flex: 1 }}>
                                Endi takrorlang
                              </T>
                              <T f="bodyBold" size={13} color="#7A5300">
                                {inRepeat ? 'ovoz chiqarib' : 'pauza 3 s'}
                              </T>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </View>
            {tracks.length > 0 && (
              <View accessibilityLabel="Dars dialoglari" style={{ gap: 8 }}>
                <T size={15} style={{ marginLeft: 4, marginBottom: 2 }}>
                  {lesson?.number}-dars dialoglari
                </T>
                {tracks.map((tr, k) => {
                  const on = k === trackIdx;
                  return (
                    <Pressable key={tr.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => !on && goTrack(k)} style={[s.trow, on && s.trowOn]}>
                      <View style={[s.tnum, { backgroundColor: on ? '#2F5BFF' : '#EEF1F7' }]}>
                        <T size={13} color={on ? '#FFFFFF' : '#34405A'}>
                          {k + 1}
                        </T>
                      </View>
                      <T size={15} lines={1} style={{ flex: 1 }}>
                        {tr.title}
                      </T>
                      <T f="bodyBold" size={13} color="#4A5468">
                        {trackNoOf(k)}-trek
                      </T>
                      {on ? (
                        <T size={13} color="#1E3FD1">
                          Tinglanmoqda
                        </T>
                      ) : (
                        !!tr.duration && (
                          <T f="bodyBold" size={13} color="#4A5468">
                            {tr.duration}
                          </T>
                        )
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </View>
    </FocusFrame>
  );
}

/** Pleer tugmasi + ostidagi <kbd>. */
function Ctl({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      {children}
      <DarkKbd>{k}</DarkKbd>
    </View>
  );
}

const s = StyleSheet.create({
  seg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  slidesTop: { height: 46, paddingHorizontal: 16, borderRadius: 15, backgroundColor: '#F4F6FA', flexDirection: 'row', alignItems: 'center', gap: 8 },
  stage: { flex: 1, alignItems: 'center', paddingVertical: 26, paddingHorizontal: 16 },
  wrap: { width: 1100, maxWidth: '100%', flex: 1, flexDirection: 'row', gap: 28 },
  left: { width: 440, flexShrink: 0, gap: 20 },
  cover: { position: 'relative', borderRadius: 26, overflow: 'hidden', flex: 1, minHeight: 0, backgroundColor: '#EAE4DF' },
  coverChip: { position: 'absolute', left: 14, top: 14, height: 30, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  qr: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E6EE', borderRadius: 10, paddingVertical: 5, paddingHorizontal: 10 },
  player: { backgroundColor: '#0B1220', borderRadius: 24, paddingTop: 22, paddingHorizontal: 24, paddingBottom: 20, gap: 16 },
  bar: { position: 'relative', height: 6, borderRadius: 3, backgroundColor: '#2B3550' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#6D8BFF' },
  knob: { position: 'absolute', top: -5, width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: '#FFFFFF' },
  round: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1B2438', alignItems: 'center', justifyContent: 'center' },
  play: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#2F5BFF', alignItems: 'center', justifyContent: 'center' },
  right: { flex: 1, minWidth: 0, gap: 18 },
  text: { flex: 1, minHeight: 0, backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 12, gap: 4 },
  textHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 4, paddingRight: 4, paddingBottom: 6, paddingLeft: 14 },
  switchBtn: { height: 44, paddingLeft: 14, paddingRight: 12, borderRadius: 14, backgroundColor: '#F4F6FA', flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchTrack: { width: 38, height: 22, borderRadius: 11, position: 'relative' },
  switchKnob: { position: 'absolute', top: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF' },
  lines: { flexGrow: 1, justifyContent: 'space-between', gap: 4 },
  line: { borderRadius: 16, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  lineCur: { backgroundColor: '#E8EEFF', boxShadow: 'inset 4px 0 0 #2F5BFF' } as object,
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ru: { fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 24.3, color: '#0B1220', fontWeight: 'normal' },
  uz: { fontFamily: fonts.body, fontSize: 14, lineHeight: 18.9, color: '#4A5468', fontWeight: 'normal' },
  repeat: { marginVertical: 2, marginHorizontal: 4, height: 46, borderRadius: 14, backgroundColor: '#FFF4D1', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  trow: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  trowOn: { backgroundColor: '#E8EEFF', boxShadow: 'inset 0 0 0 2px #2F5BFF' } as object,
  tnum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quick: { height: 54, borderRadius: 17, backgroundColor: '#E8EEFF', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18 },
  second: { height: 54, paddingHorizontal: 20, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#E2E6EE', flexDirection: 'row', alignItems: 'center', gap: 8 },
  cta: { height: 54, paddingLeft: 26, paddingRight: 22, borderRadius: 17, backgroundColor: '#2F5BFF', flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, boxShadow: '0 5px 0 #1E3FD1' } as object,
});
